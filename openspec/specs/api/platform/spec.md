# API: Platform (Super-admin)

## Overview

Platform operator login (`PlatformAdmin`), organization lifecycle, catalog of `Feature` and `IndustryTemplate`, and global `PlatformConfig` key/value. Protected routes (everything except login) require a JWT with `platformAdmin: true` claim (`platformAuthMiddleware`).

## API Endpoints

Base path: `/api/platform`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Email/password → JWT + sanitized admin object. |
| GET | `/organizations` | List orgs; optional `isActive`, `industry` query. |
| GET | `/organizations/{id}` | Org detail with branches and tenant role summary; `404` if missing. |
| POST | `/organizations` | Create org, seed roles from industry template (or defaults), seed permissions, create owner user. |
| PATCH | `/organizations/{id}` | Partial update via `PlatformService.updateOrganization`. |
| DELETE | `/organizations/{id}` | Soft deactivate `isActive: false` (direct Prisma in handler). |
| GET | `/features` | All features ordered by module. |
| GET | `/templates` | Industry templates. |
| GET | `/config` | All `platformConfig` rows. |
| PUT | `/config` | Upsert single key/value (`platformConfigSchema`). |

## Request and response bodies

### POST `/auth/login`

**Request body:**

```json
{
  "email": "string (email)",
  "password": "string (min 1)"
}
```

**200**

```json
{
  "success": true,
  "data": {
    "token": "string (JWT)",
    "admin": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "role": "PLATFORM_SUPPORT | …",
      "isActive": true,
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  }
}
```

(`passwordHash` is stripped from `admin`.)

**401:** `{ "success": false, "message": "Invalid credentials" }`

### GET `/organizations`

**Query:** `isActive?` (`"true"` | `"false"` only), `industry?` (string).

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "slug": "string",
      "industryType": "string",
      "isActive": true,
      "createdAt": "string (ISO 8601)",
      "_count": { "branches": 0, "users": 0 }
    }
  ]
}
```

### GET `/organizations/{id}`

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "slug": "string",
    "industryType": "string",
    "isActive": true,
    "branches": [
      { "id": "string", "name": "string", "city": "string | null", "isActive": true }
    ],
    "tenantRoles": [
      {
        "id": "string",
        "name": "string",
        "scope": "string",
        "isServiceProvider": true
      }
    ],
    "_count": { "branches": 0, "users": 0 }
  }
}
```

**404:** `{ "success": false, "message": "Organization not found" }`

### POST `/organizations`

**Request body:**

```json
{
  "name": "string (min 1)",
  "slug": "string (lowercase alphanumeric + hyphens, min 2)",
  "industry": "BARBERSHOP | VET_CLINIC | MASSAGE | NAIL_SALON | SPA | PET_GROOMING | DENTAL_CLINIC | AUTO_DETAILING | BEAUTY_SALON | TATTOO_PARLOR | GENERAL_SERVICE",
  "ownerEmail": "string (email)",
  "ownerFirstName": "string (min 1)",
  "ownerLastName": "string (min 1)",
  "ownerPassword": "string (min 8)"
}
```

**201**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "slug": "string",
    "industryType": "string",
    "roles": [
      {
        "id": "string",
        "organizationId": "string",
        "name": "string",
        "scope": "string",
        "isServiceProvider": true
      }
    ]
  }
}
```

**400:** `{ "success": false, "message": "string" }` — e.g. `"Organization slug already in use"`.

### PATCH `/organizations/{id}`

**Request body (all optional):**

```json
{
  "name": "string (min 1)",
  "isActive": true,
  "taxName": "string",
  "taxRate": 0,
  "taxInclusive": true,
  "currency": "string (3 chars)",
  "locale": "string",
  "timezone": "string"
}
```

**200:** `{ "success": true, "data": { ...organization record after update } }`

### DELETE `/organizations/{id}`

**200:** `{ "success": true, "data": { ...organization with isActive: false } }`

### GET `/features`

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "code": "string",
      "name": "string",
      "description": "string | null",
      "module": "string (FeatureModule enum)",
      "sortOrder": 0,
      "isActive": true,
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

### GET `/templates`

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "industryType": "string (IndustryType enum)",
      "name": "string",
      "description": "string | null",
      "templateData": {},
      "isActive": true,
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

### GET `/config`

**200**

```json
{
  "success": true,
  "data": [
    {
      "key": "string (primary key)",
      "value": "string",
      "updatedBy": "string | null",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

### PUT `/config`

**Request body:**

```json
{
  "key": "string (min 1)",
  "value": "string"
}
```

**200**

```json
{
  "success": true,
  "data": {
    "key": "string",
    "value": "string",
    "updatedBy": "string | null",
    "updatedAt": "string (ISO 8601)"
  }
}
```

## Business Rules

1. **Login:** bcrypt compare on `platformAdmin.passwordHash`; failure → **401** “Invalid credentials”. JWT includes `platformAdmin: true`, `sub`, `email`, `exp` 24h.
2. **List orgs:** `isActive` filter only when query is exactly `"true"` or `"false"`.
3. **Create org**: Unique `slug`; duplicate → **400** “Organization slug already in use”. Uses `industryTemplate` for `defaultRoles` JSON when present; else Owner/Manager/Staff/Customer defaults. Grants permissions for all features in DB to seeded roles (HQ-heavy pattern in service). The owner user is created with `NotificationPreference` set to `emailOptOut: false`.
4. **Protected routes:** Missing/invalid Bearer → **401**. Valid tenant token without `platformAdmin` → **403** “platform admin access required”.
5. **Deactivate:** Hard Prisma `organization.update` — invalid id surfaces as Prisma error / **500** depending on error handling.

## Scenarios

### Success

- **GIVEN** valid platform admin credentials **WHEN** POST `/auth/login` **THEN** **200**, `data.token`, `data.admin` without `passwordHash`.
- **GIVEN** platform admin JWT **WHEN** GET `/organizations` **THEN** **200** with org list.

### Failure

- **GIVEN** wrong password **WHEN** POST `/auth/login` **THEN** **401**.
- **GIVEN** no Authorization **WHEN** GET `/organizations` **THEN** **401**.
- **GIVEN** tenant JWT **WHEN** GET `/organizations` **THEN** **403**.
- **GIVEN** platform JWT **WHEN** GET `/organizations/{id}` for unknown id **THEN** **404**.
- **GIVEN** duplicate org slug **WHEN** POST `/organizations` **THEN** **400** `"Organization slug already in use"`.
- **409:** **N/A** — duplicate slug is **400**, not **409**.

## Edge Cases

- Create org transaction timeout set to 30s in service.
- `updateOrganization` passes partial Prisma `data` — invalid fields depend on Prisma validation.

## RBAC

- **Platform admin JWT** (not tenant `TenantRolePermission` catalog).
- Login route is public (no `platformAuthMiddleware`).

## Dependencies

- **Prisma**: `platformAdmin`, `organization`, `industryTemplate`, `tenantRole`, `tenantRolePermission`, `feature`, `user`, `platformConfig`
- **Middleware**: `platformAuthMiddleware` on protected sub-router
- **Crypto**: `bcryptjs`, `hono/jwt` `sign`/`verify`
