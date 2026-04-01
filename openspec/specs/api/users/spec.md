# API Feature: User Management (`/api/users`)

## Overview

Tenant-scoped user directory and administration: paginated listing with filters, user detail, role changes, branch assignment/removal, deactivate/reactivate. Handlers use `UsersService` and write `auditLog` entries for mutating operations.

## API Endpoints

| Method | Path | RBAC (feature / action) | Description |
|--------|------|---------------------------|-------------|
| GET | `/` | `USER_MANAGEMENT` / **read** | List users with optional `role`, `branchId`, `search`, `isActive`, `page`, `limit`. |
| GET | `/{id}` | `USER_MANAGEMENT` / **read** | User detail by id. |
| PATCH | `/{id}/role` | `USER_MANAGEMENT` / **update** | Change role: body `{ role }` enum or tenant role id string. |
| POST | `/{id}/assign-branch` | `USER_MANAGEMENT` / **update** | Set user `branchId` (+ optional `position` in schema, unused in service). |
| DELETE | `/{id}/assign-branch/{branchId}` | `USER_MANAGEMENT` / **update** | Clear assignment if user’s `branchId` matches. |
| PATCH | `/{id}/deactivate` | `USER_MANAGEMENT` / **update** | Set `isActive: false` with safeguards. |
| PATCH | `/{id}/reactivate` | `USER_MANAGEMENT` / **update** | Set `isActive: true`. |

All routes: `authMiddleware` + `orgScopeMiddleware` (requires `organizationId` on JWT).

## Request and response bodies

### GET `/` — list users

**Query:** `role?`, `branchId?`, `search?`, `isActive?`, `page?` (default `"1"`), `limit?` (default `"20"`).

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phone": "string | null",
      "tenantRoleId": "string",
      "tenantRole": { "name": "string", "scope": "string" },
      "isActive": true,
      "createdAt": "string (ISO 8601)",
      "branchId": "string | null",
      "branch": { "id": "string", "name": "string" } | null,
      "staffProfile": { "id": "string", "tier": "string" } | null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### GET `/{id}` — user detail

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "phone": "string | null",
    "tenantRole": { "id": "string", "name": "string", "scope": "string" },
    "isActive": true,
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)",
    "branch": { "id": "string", "name": "string" } | null,
    "staffProfile": { "id": "string", "tier": "string", "bio": "string | null" } | null,
    "customerMembership": { "id": "string", "pointsBalance": 0, "tier": "string" } | null
  }
}
```

**404:** `{ "success": false, "message": "User not found" }`

### PATCH `/{id}/role` — change role

**Request body (OpenAPI schema; handler also accepts `tenantRoleId` in practice):**

```json
{
  "role": "CUSTOMER | BARBER | CASHIER | SUPERVISOR | MANAGER | SUPER_ADMIN"
}
```

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "tenantRoleId": "string",
    "tenantRole": { "name": "string", "scope": "string" },
    "isActive": true
  }
}
```

**400:** `{ "success": false, "message": "string" }` — invalid role, last HQ user constraint, etc.

**404:** `{ "success": false, "message": "User not found" }` or role resolution failure per handler mapping.

### POST `/{id}/assign-branch`

**Request body:**

```json
{
  "branchId": "string",
  "position": "string (optional, ignored by service)"
}
```

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "branchId": "string | null",
    "branch": { "id": "string", "name": "string" } | null
  }
}
```

**400:** `{ "success": false, "message": "string" }` — e.g. user not found.

### DELETE `/{id}/assign-branch/{branchId}`

**200**

```json
{
  "success": true,
  "data": { "removed": true }
}
```

**404:** `{ "success": false, "message": "Assignment not found" }` (user missing or `branchId` mismatch).

### PATCH `/{id}/deactivate`

No request body.

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "tenantRoleId": "string",
    "tenantRole": { "name": "string", "scope": "string" },
    "isActive": false
  }
}
```

**400:** `{ "success": false, "message": "string" }` — cannot deactivate self, last HQ user, etc.

**404:** `{ "success": false, "message": "User not found" }`

### PATCH `/{id}/reactivate`

No request body.

**200:** same user shape as deactivate with `isActive: true`.

**404:** `{ "success": false, "message": "User not found" }`

## Business Rules

1. **List:** Results are filtered by `organizationId` from scoped DB. If caller `scope` is `MANAGER` (from JWT `scope` string) and `callerBranchId` is set, results are restricted to that branch when `branchId` query is not passed.
2. **`isActive` query:** Compared as string `"true"` for filtering.
3. **Update role:** A `role` value without `-` and length &lt; 20 is treated as **role name** and resolved via `tenantRole` in the same organization. Cannot demote last active HQ-scoped user (service throws). Same-role no-op returns current user.
4. **Deactivate:** Cannot deactivate self. Cannot deactivate last active HQ-scoped user.
5. **Remove branch:** **404** if user not found or `branchId` param does not match user’s `branchId`.

## Scenarios

### Success

- **GIVEN** JWT with org + `USER_MANAGEMENT` read **WHEN** GET `/` **THEN** **200**, `data` array + `pagination`.
- **GIVEN** valid user id **WHEN** GET `/{id}` **THEN** **200** and user payload.
- **GIVEN** valid admin and target user **WHEN** PATCH `/{id}/role` with valid role **THEN** **200** and updated user.
- **GIVEN** valid assignment **WHEN** POST `/{id}/assign-branch` **THEN** **200** and user/branch info.
- **GIVEN** matching branch **WHEN** DELETE assign-branch **THEN** **200** `{ removed: true }`.
- **GIVEN** another user **WHEN** PATCH deactivate **THEN** **200** and `isActive: false`.
- **GIVEN** inactive user **WHEN** PATCH reactivate **THEN** **200** and `isActive: true`.

### Failure

- **GIVEN** no/invalid JWT **WHEN** any route **THEN** **401**.
- **GIVEN** JWT without permission **WHEN** route **THEN** **403**.
- **GIVEN** JWT without `organizationId` **WHEN** after auth **THEN** **403** from `orgScopeMiddleware`.
- **GIVEN** unknown user id **WHEN** GET `/{id}` **THEN** **404**.
- **GIVEN** deactivate self **WHEN** PATCH `/{id}/deactivate` **THEN** **400**.
- **GIVEN** remove branch mismatch **WHEN** DELETE assign-branch **THEN** **404**.
- **409:** **N/A** — no unique constraints exposed as **409** on user management endpoints.

## Edge Cases

- **Pagination:** `page`/`limit` from query strings default `"1"` / `"20"` in schema; parsed with `parseInt` in handler.
- **updateRole handler:** Accepts `tenantRoleId` or `role` via body shape; uses non-null assertion internally—invalid empty body can cause runtime errors.

## RBAC

| Action | Feature | Operation |
|--------|---------|-----------|
| List, get | `USER_MANAGEMENT` | `read` |
| Role, branch, deactivate, reactivate | `USER_MANAGEMENT` | `update` |

## Dependencies

- **Prisma:** `user`, `tenantRole`, `auditLog` (and related selects).
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
