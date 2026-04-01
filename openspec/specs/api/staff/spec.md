# API Feature: Staff (`/api/staff`)

## Overview

`StaffProfile` lifecycle and assignments: paginated list and get-by-id are **public**; create/update/deactivate and branch assign/remove require `STAFF_MANAGEMENT`. Status updates use `requireStaff()` (non-customer) without the `STAFF_MANAGEMENT` permission flag.

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|-------------|-------------|
| GET | `/` | Public | Paginated staff list; filters `branchId`, `tier`, `isActive` (string→bool), `page`, `limit`. |
| GET | `/{id}` | Public | Staff profile where `StaffProfile.userId === {id}` (**id is user id**, not staffProfile id). |
| POST | `/` | Bearer + `STAFF_MANAGEMENT` **create** | Create `StaffProfile` for `userId`; initial `status: OFF_DUTY`. |
| PATCH | `/{id}` | Bearer + `STAFF_MANAGEMENT` **update** | Update profile fields (`userId` in path). |
| DELETE | `/{id}` | Bearer + `STAFF_MANAGEMENT` **delete** | Deactivate underlying **user** (`isActive: false`). |
| POST | `/{id}/branches` | Bearer + `STAFF_MANAGEMENT` **update** | Assign user to `branchId`. Path `{id}` is **StaffProfile.id** (see edge cases). |
| DELETE | `/{id}/branches` | Bearer + `STAFF_MANAGEMENT` **update** | Clear user’s `branchId` (lookup by staff profile id). |
| PATCH | `/{id}/status` | Bearer + **staff** (`requireStaff`) | Update `StaffProfile.status`. |

## Request / response shapes (selected endpoints)

### GET `/` — list

**Query:** optional `branchId`, `tier` (`JUNIOR` | `SENIOR` | `MASTER`), `isActive` (`"true"` | `"false"`), `page`, `limit`.

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": [
    {
      "id": "string (staffProfile id)",
      "userId": "string",
      "organizationId": "string",
      "tier": "string",
      "bio": "string | null",
      "specialties": ["string"],
      "commissionModel": "FLAT_PERCENTAGE | SLIDING_SCALE | BASE_PLUS_BONUS",
      "commissionRate": 0,
      "baseSalary": 0,
      "bonusRate": "number | null",
      "status": "AVAILABLE | BUSY | ON_BREAK | RESERVED | OFF_DUTY",
      "user": {
        "id": "string",
        "email": "string",
        "firstName": "string",
        "lastName": "string",
        "branchId": "string | null",
        "isActive": true
      }
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

### POST `/` — create

**Request** (`application/json`):

```json
{
  "userId": "string (existing user in org)",
  "bio": "string (optional)",
  "tier": "JUNIOR | SENIOR | MASTER",
  "specialties": [],
  "commissionModel": "FLAT_PERCENTAGE | SLIDING_SCALE | BASE_PLUS_BONUS",
  "commissionRate": 0.4,
  "baseSalary": 0,
  "bonusRate": 0
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "userId": "string",
    "status": "OFF_DUTY",
    "user": {}
  }
}
```

### PATCH `/{id}` — update (`{id}` = user id)

**Request** (`application/json`): partial of create fields plus optional `isActive`, `status`.

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "userId": "string",
    "user": {}
  }
}
```

### POST `/{id}/branches` — assign (`{id}` = staff profile id)

**Request** (`application/json`):

```json
{
  "branchId": "string"
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string (user id)",
    "branchId": "string",
    "branch": { "id": "string", "name": "string" }
  }
}
```

### DELETE `/{id}/branches`

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "message": "Staff removed from branch"
}
```

### PATCH `/{id}/status` (`{id}` = user id)

**Request** (`application/json`):

```json
{
  "status": "AVAILABLE | BUSY | ON_BREAK | RESERVED | OFF_DUTY"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "userId": "string",
    "status": "string"
  }
}
```

## Business Rules

1. **List:** Filters by `StaffProfile` tier, optional `user.branchId`, optional user active flag.
2. **Get by id:** `findUnique({ where: { userId: id } })`.
3. **Create:** Requires existing user; sets commission fields, `status: OFF_DUTY`.
4. **Assign/remove branch:** Loads `StaffProfile` by **`StaffProfile.id`** (`findUniqueOrThrow`), then updates linked `user.branchId`.
5. **Delete (deactivate):** Updates `user.isActive`, not a `StaffProfile` row delete.

## Scenarios

### Success

- **GIVEN** no auth **WHEN** GET `/` **THEN** **200** with pagination.
- **GIVEN** existing staff user id **WHEN** GET `/{userId}` **THEN** **200**.
- **GIVEN** unknown user id **WHEN** GET `/{id}` **THEN** **404** “Staff not found”.
- **GIVEN** manager token + permission **WHEN** POST `/` **THEN** **201**.

### Failure

- **GIVEN** no token **WHEN** POST `/` **THEN** **401**.
- **GIVEN** customer JWT **WHEN** PATCH `/{id}/status` **THEN** **403** staff-only.
- **GIVEN** staff JWT without `STAFF_MANAGEMENT` **WHEN** POST `/` **THEN** **403**.
- **GIVEN** invalid JSON or failed Zod validation **WHEN** POST `/`, PATCH `/{id}`, POST `/{id}/branches`, or PATCH `/{id}/status` **THEN** **400**.
- **GIVEN** unknown user id **WHEN** PATCH `/{id}` (profile update) **THEN** **404** (intended REST semantics; Prisma may surface **500** if uncaught — implementation gap).
- **GIVEN** unknown staff profile id **WHEN** POST `/{id}/branches` **THEN** **404** / not found (service `findUniqueOrThrow`; may surface as **500** if unmapped).

### HTTP status coverage (`PATCH /{userId}` profile)

| Code | Applies |
|------|---------|
| **200** | Profile updated. |
| **201** | N/A — not used for PATCH. |
| **400** | Invalid body. |
| **401** | Missing JWT. |
| **403** | Missing `STAFF_MANAGEMENT` or org scope. |
| **404** | Spec: staff profile not found for `userId`; GET `/{id}` implements **404**. |
| **409** | N/A — no alternate conflict rule documented for staff profile update. |
| **500** | Uncaught Prisma errors on update when record missing (gap vs **404**). |

## Edge Cases

- **ID semantics:** `GET /{id}` uses **user id**; `POST/DELETE /{id}/branches` uses **staff profile id** (`StaffProfile.id`). Clients must not confuse the two.
- **update partial:** `specialties` uses `??` in service—passing `undefined` vs omitted behaves per Zod partial rules.

## RBAC

- **`STAFF_MANAGEMENT`:** create, update (profile + branch assign/remove), delete.
- **`PATCH /{id}/status`:** `requireStaff()` only (non-customer); not gated by `STAFF_MANAGEMENT` permission matrix in code.

## Dependencies

- **Prisma:** `staffProfile`, `user`, `branch` (via includes).
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`, `requireStaff`.
