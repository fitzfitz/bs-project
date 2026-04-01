# API: Roles (Tenant RBAC)

## Overview

CRUD for `TenantRole`, permission matrix CRUD, and service assignments for service-provider roles. All operations are scoped to the authenticated user’s `organizationId` via org-scoped Prisma.

## API Endpoints

Base path: `/api/roles`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List roles with user/permission counts. |
| POST | `/` | Create custom role. |
| PATCH | `/{id}` | Update role fields. |
| DELETE | `/{id}` | Delete role (guards below). |
| GET | `/{id}/permissions` | Permission rows with feature metadata. |
| PUT | `/{id}/permissions` | Replace entire matrix; body `{ permissions: [...] }`. |
| GET | `/{id}/services` | Assigned services for role. |
| PUT | `/{id}/services` | Replace assignments; body `{ serviceIds: string[] }`. |

## Request and response bodies

### GET `/` — list roles

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "organizationId": "string",
      "name": "string",
      "description": "string | null",
      "scope": "HQ | BRANCH | CUSTOMER",
      "isDefault": true,
      "isSystemRole": true,
      "isServiceProvider": true,
      "sortOrder": 0,
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)",
      "_count": { "users": 0, "permissions": 0 }
    }
  ]
}
```

### POST `/` — create role

**Request body:**

```json
{
  "name": "string (1–100 chars)",
  "description": "string (optional)",
  "scope": "HQ | BRANCH | CUSTOMER",
  "isServiceProvider": false
}
```

**201**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "organizationId": "string",
    "name": "string",
    "description": "string | null",
    "scope": "HQ | BRANCH | CUSTOMER",
    "isDefault": true,
    "isSystemRole": true,
    "isServiceProvider": true,
    "sortOrder": 0,
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

### PATCH `/{id}` — update role

**Request body (all optional):**

```json
{
  "name": "string (1–100)",
  "description": "string",
  "scope": "HQ | BRANCH | CUSTOMER",
  "isServiceProvider": true
}
```

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "organizationId": "string",
    "name": "string",
    "description": "string | null",
    "scope": "HQ | BRANCH | CUSTOMER",
    "isDefault": true,
    "isSystemRole": true,
    "isServiceProvider": true,
    "sortOrder": 0,
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**400:** `{ "success": false, "message": "string" }` — e.g. `"Role not found"`, `"Cannot change scope of a system role"`.

### DELETE `/{id}`

**200:** `{ "success": true, "message": "Role deleted" }`

**400:** `{ "success": false, "message": "string" }` — e.g. `"Cannot delete a system role"`, `"Cannot delete role with assigned users..."`, `"Role not found"`.

### GET `/{id}/permissions`

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "tenantRoleId": "string",
      "featureCode": "string",
      "canCreate": true,
      "canRead": true,
      "canUpdate": true,
      "canDelete": true,
      "feature": {
        "code": "string",
        "name": "string",
        "module": "string"
      }
    }
  ]
}
```

### PUT `/{id}/permissions`

**Request body:**

```json
{
  "permissions": [
    {
      "featureCode": "string",
      "canCreate": true,
      "canRead": true,
      "canUpdate": true,
      "canDelete": true
    }
  ]
}
```

**200:** same shape as GET `/{id}/permissions` `data` (full matrix after replace).

### GET `/{id}/services`

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "tenantRoleId": "string",
      "serviceId": "string",
      "organizationId": "string",
      "service": {
        "id": "string",
        "name": "string",
        "category": "string"
      }
    }
  ]
}
```

### PUT `/{id}/services`

**Request body:**

```json
{
  "serviceIds": ["string"]
}
```

**200:** same shape as GET `/{id}/services` `data` (assignments after replace).

## Business Rules

1. **Create:** `name` 1–100 chars, optional `description`, `scope` enum, `isServiceProvider` default false.
2. **Update:** `Role not found` → thrown, handler returns **400**. System roles: cannot change `scope` to a different value; other fields may update per service logic.
3. **Delete:** Cannot delete system roles; cannot delete if any users assigned; deletes permissions and role-services first.
4. **Permissions PUT:** Deletes all `TenantRolePermission` for role then recreates; calls `invalidatePermissionCache(roleId)`.
5. **Services PUT:** Scoped by `organizationId` from JWT when creating `TenantRoleService` rows.

## Scenarios

### Success

- **GIVEN** `ROLE_MANAGEMENT` read **WHEN** GET `/` **THEN** **200** with roles array.
- **GIVEN** `ROLE_MANAGEMENT` create **WHEN** POST `/` **THEN** **201**.
- **GIVEN** `ROLE_MANAGEMENT` update **WHEN** PUT `/{id}/permissions` **THEN** **200** with new matrix.

### Failure

- **GIVEN** no auth **WHEN** any route **THEN** **401**.
- **GIVEN** auth without required `ROLE_MANAGEMENT` action **WHEN** matching route **THEN** **403**.
- **GIVEN** unknown role id on PATCH **WHEN** update **THEN** **400** `"Role not found"` (not **404** in current handler).
- **GIVEN** delete system role **WHEN** DELETE `/{id}` **THEN** **400** `"Cannot delete a system role"`.
- **409:** **N/A** — no unique constraint violation exposed as **409** on these endpoints.

## Edge Cases

- Handlers use `c.get("db")` — must match middleware `c.set("db", …)` (same as rest of app).
- Empty `permissions` array on PUT clears all permissions for the role.

## RBAC

| Route pattern | Feature | Action |
|---------------|---------|--------|
| GET `/`, GET `/*/permissions`, GET `/*/services` | `ROLE_MANAGEMENT` | `read` |
| POST `/` | `ROLE_MANAGEMENT` | `create` |
| PATCH `/*`, PUT `/*/permissions`, PUT `/*/services` | `ROLE_MANAGEMENT` | `update` |
| DELETE `/*` | `ROLE_MANAGEMENT` | `delete` |

## Dependencies

- **Prisma**: `tenantRole`, `tenantRolePermission`, `tenantRoleService`, `feature`, `service`
- **Middleware**: `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Side effects**: `invalidatePermissionCache` from RBAC middleware module
