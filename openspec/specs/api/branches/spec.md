# API Feature: Branches (`/api/branches`)

## Overview

Branch CRUD and operational settings: listing (optional filters), detail, create/update/deactivate, operating hours replacement, surge pricing rules, emergency close/reopen (queue/booking cancellations + optional Pusher), and branch holidays. Most mutating routes require auth, org scope, and `BRANCH_MANAGEMENT` permissions.

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|-------------|-------------|
| GET | `/` | Public | List branches; query `city`, `isActive` (string `"true"`/`"false"` transformed to boolean). |
| GET | `/{id}` | Public | Branch by id with relations. |
| GET | `/{id}/holidays` | Public | List holidays for branch. |
| POST | `/` | Bearer + `BRANCH_MANAGEMENT` **create** | Create branch for current org. |
| PATCH | `/{id}` | Bearer + `BRANCH_MANAGEMENT` **update** | Partial update; optional `tipDistribution`, `isActive`. |
| DELETE | `/{id}` | Bearer + `BRANCH_MANAGEMENT` **delete** | Soft deactivate (`isActive: false`). |
| PUT | `/{id}/operating-hours` | Bearer + `BRANCH_MANAGEMENT` **update** | Replace all operating hours for branch (delete many + create many). |
| POST | `/{id}/surge-rules` | Bearer + `BRANCH_MANAGEMENT` **update** | Create surge rules per day in payload. |
| PATCH | `/{id}/surge-rules/{ruleId}` | Bearer + `BRANCH_MANAGEMENT` **update** | Update one surge rule. |
| DELETE | `/{id}/surge-rules/{ruleId}` | Bearer + `BRANCH_MANAGEMENT` **delete** | Delete surge rule. |
| POST | `/{id}/emergency-close` | Bearer + `BRANCH_MANAGEMENT` **update** | Set `isEmergencyClosed`, cancel today’s waiting/called queue + confirmed bookings; audit; Pusher broadcast; push notifications + in-app Notification records for affected customers via NotificationService. |
| POST | `/{id}/reopen` | Bearer + `BRANCH_MANAGEMENT` **update** | Clear emergency flag; audit; Pusher broadcast; push notification to recently affected customers via NotificationService. |
| POST | `/{id}/holidays` | Bearer + `BRANCH_MANAGEMENT` **create** | Create holiday. |
| PATCH | `/{id}/holidays/{holidayId}` | Bearer + `BRANCH_MANAGEMENT` **update** | Update holiday. |
| DELETE | `/{id}/holidays/{holidayId}` | Bearer + `BRANCH_MANAGEMENT` **delete** | Delete holiday. |

## Request / response shapes (selected endpoints)

### GET `/` — list

**Query:** optional `city`, `isActive` (`"true"` | `"false"` string).

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "city": "string",
      "phone": "string | null",
      "email": "string | null",
      "latitude": "number | null",
      "longitude": "number | null",
      "imageUrl": "string | null",
      "isActive": true,
      "isEmergencyClosed": false,
      "organizationId": "string",
      "operatingHours": [],
      "surgeRules": []
    }
  ]
}
```

### POST `/` — create

**Request** (`application/json`):

```json
{
  "name": "string",
  "address": "string",
  "city": "string",
  "phone": "string (optional)",
  "email": "string (optional, valid email or \"\")",
  "latitude": 0,
  "longitude": 0,
  "imageUrl": "string (optional, URL or \"\")"
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "organizationId": "string",
    "name": "string",
    "address": "string",
    "city": "string",
    "isActive": true
  }
}
```

### PATCH `/{id}` — update

**Request** (`application/json`): partial fields from create schema plus optional:

```json
{
  "isActive": true,
  "tipDistribution": "PER_STAFF | POOLED"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": { "id": "string", "name": "string" }
}
```

### PUT `/{id}/operating-hours`

**Request** (`application/json`):

```json
{
  "hours": [
    {
      "day": "MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY",
      "openTime": "HH:mm or HH:mm:00",
      "closeTime": "HH:mm or HH:mm:00",
      "isClosed": false
    }
  ]
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": []
}
```

(`data` is the array of persisted operating-hour rows.)

### POST `/{id}/surge-rules`

**Request** (`application/json`):

```json
{
  "name": "string",
  "days": ["MONDAY"],
  "startHour": 0,
  "endHour": 23,
  "multiplier": 1.0,
  "isActive": true
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "branchId": "string",
    "name": "string",
    "dayOfWeek": "MONDAY",
    "startHour": 0,
    "endHour": 23,
    "multiplier": 1.0,
    "isActive": true
  }
}
```

(Handler returns the first created row when multiple days are expanded in service.)

## Business Rules

1. **Create:** Persists `organizationId` from JWT context; default `isActive: true`.
2. **List (public):** No `organizationId` filter in service—returns branches matching city/active filters globally (implementation detail).
3. **Operating hours:** Full replace per request; times must match schema regex (HH:mm / optional `:00`).
4. **Surge rules:** One Prisma row per day in `days` array; handler returns first created row.
5. **Emergency close:** Cancels `queueEntry` in `WAITING`/`CALLED`; cancels `booking` `CONFIRMED` for **today** (local midnight window in server TZ).
6. **Holidays:** `date` validated as `YYYY-MM-DD`.

## Scenarios

### Success

- **GIVEN** no auth **WHEN** GET `/` **THEN** **200** and branch array.
- **GIVEN** existing branch **WHEN** GET `/{id}` **THEN** **200**.
- **GIVEN** missing branch **WHEN** GET `/{id}` **THEN** **404** “Branch not found”.
- **GIVEN** token + `BRANCH_MANAGEMENT` create **WHEN** POST `/` with valid body **THEN** **201**.

### Failure

- **GIVEN** no token **WHEN** POST `/` **THEN** **401**.
- **GIVEN** token without create permission **WHEN** POST `/` **THEN** **403**.
- **GIVEN** no org on token **WHEN** mutating route **THEN** **403** from org scope.
- **GIVEN** invalid JSON body or schema violation **WHEN** POST `/` or PATCH `/{id}` or PUT `/{id}/operating-hours` or POST `/{id}/surge-rules` **THEN** **400** (validation / OpenAPI).
- **GIVEN** unknown branch id **WHEN** PATCH `/{id}` **THEN** **404** (intended REST semantics; Prisma may surface **500** if uncaught — implementation gap).
- **GIVEN** unknown branch id **WHEN** DELETE `/{id}` **THEN** **404** (intended REST semantics; Prisma may surface **500** if uncaught — implementation gap).

### HTTP status coverage (mutating branch by id)

| Code | Applies |
|------|---------|
| **200** | Update, deactivate success, operating hours, surge update/delete messages. |
| **201** | Create branch; create surge rule. |
| **400** | Invalid body (Zod/OpenAPI). |
| **401** | Missing Bearer on protected routes. |
| **403** | Missing org scope or `BRANCH_MANAGEMENT` permission. |
| **404** | Spec: unknown branch on update/delete; GET `/{id}` returns explicit **404**. |
| **409** | N/A — no unique business constraint documented on branch name per org in this API. |
| **500** | Uncaught Prisma errors on missing ids for PATCH/DELETE (known gap vs **404** above). |

## Edge Cases

- **Middleware ordering:** Multiple `use` calls on overlapping paths rely on Hono’s routing; prefer matching exact documented paths when testing.
- **Prisma errors** on update/delete missing ids: uncaught → **500** (no feature-level **404** on update branch in current handlers).
- **`listBranches` `isActive`:** Optional; omit means no filter on active flag.

## RBAC

Feature code: **`BRANCH_MANAGEMENT`**. Actions: **create**, **update**, **delete** as mounted per route above. Public: list branch, get branch, list holidays.

## Dependencies

- **Prisma:** `branch`, `operatingHour`, `surgeRule`, `queueEntry`, `booking`, `branchHoliday`, `auditLog`.
- **Optional:** Pusher via `getPusher(c)` for emergency/reopen.
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
