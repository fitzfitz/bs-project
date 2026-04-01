# API Feature: Campaigns (`/api/campaigns`)

## Overview

Marketing campaigns (`Campaign` model): list/create/update, send to segment or branch transaction audience, and delete. Send integrates with `NotificationService` (push vs log for other channels).

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|----------------|-------------|
| GET | `/` | Bearer + org scope + `CAMPAIGNS` **read** | Paginated list with optional `branchId`, `status` filters. |
| POST | `/` | Bearer + org scope + `CAMPAIGNS` **read** | Create campaign (`DRAFT`). |
| PATCH | `/:id` | Bearer + org scope + `CAMPAIGNS` **read** | Update; only `DRAFT` or `SCHEDULED` editable. |
| POST | `/:id/send` | Bearer + org scope + `CAMPAIGNS` **read** | Dispatch notifications; sets status `ACTIVE` and `sentCount`. |
| DELETE | `/:id` | Bearer + org scope + `CAMPAIGNS` **delete** | Delete campaign. |

Mounted under `/api/campaigns`.

## Request and response bodies

### GET `/` — list

**Query:** `branchId?`, `status?` (`DRAFT` | `SCHEDULED` | `ACTIVE` | `COMPLETED` | `CANCELLED`), `page` (default 1), `limit` (default 20, max 50).

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "branchId": "string | null",
      "name": "string",
      "description": "string | null",
      "type": "EMAIL | PUSH | IN_APP",
      "promoCodeId": "string | null",
      "segmentId": "string | null",
      "status": "DRAFT | SCHEDULED | ACTIVE | COMPLETED | CANCELLED",
      "startsAt": "string (ISO 8601)",
      "endsAt": "string (ISO 8601) | null",
      "sentCount": 0,
      "openCount": 0,
      "createdAt": "string (ISO 8601)"
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

**Request body:**

```json
{
  "branchId": "string (optional)",
  "name": "string (1–100)",
  "description": "string (optional, max 500)",
  "type": "EMAIL | PUSH | IN_APP",
  "promoCodeId": "string (optional)",
  "segmentId": "string (optional)",
  "startsAt": "string (ISO 8601 datetime)",
  "endsAt": "string (ISO 8601 datetime, optional)"
}
```

**201**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "branchId": "string | null",
    "name": "string",
    "description": "string | null",
    "type": "EMAIL | PUSH | IN_APP",
    "promoCodeId": "string | null",
    "segmentId": "string | null",
    "status": "DRAFT",
    "startsAt": "string (ISO 8601)",
    "endsAt": "string (ISO 8601) | null",
    "sentCount": 0,
    "openCount": 0,
    "createdAt": "string (ISO 8601)"
  }
}
```

**400:** `{ "success": false, "message": "string" }` — validation or business rule (e.g. invalid promo, missing segment).

### PATCH `/:id` — update

**Request body (all optional):**

```json
{
  "name": "string (1–100)",
  "description": "string (max 500)",
  "type": "EMAIL | PUSH | IN_APP",
  "promoCodeId": "string | null",
  "segmentId": "string | null",
  "status": "DRAFT | SCHEDULED | CANCELLED",
  "startsAt": "string (ISO 8601)",
  "endsAt": "string (ISO 8601) | null"
}
```

**200:** `{ "success": true, "data": { ...campaign shape as in list } }`

**400:** `{ "success": false, "message": "string" }` — e.g. `"Campaign not found"`, `"Only DRAFT or SCHEDULED campaigns can be edited"`.

### POST `/:id/send`

No request body.

**200**

```json
{
  "success": true,
  "data": {
    "sent": 0,
    "recipientCount": 0
  }
}
```

**400:** `{ "success": false, "message": "string" }` — e.g. `"Campaign not found"`, `"Campaign cannot be sent in its current status"`.

### DELETE `/:id`

**200:** `{ "success": true, "message": "Campaign deleted" }`

*(If campaign missing, service throws; handler does not catch — may **500**.)*

## Business Rules

1. **Create:** If `promoCodeId` set, promo must exist and `isActive`. If `segmentId` set, segment must exist.
2. **Update:** If current status not in `DRAFT` | `SCHEDULED`, reject.
3. **Send:** Campaign must exist; status must be `DRAFT` or `SCHEDULED`. Recipients: segment members if `segmentId`; else distinct `customerId` from completed branch transactions if `branchId`; else empty. PUSH uses `notificationService.sendPush`; EMAIL/IN_APP log only but still increment `sent`. Updates `sentCount` and `status: ACTIVE`.
4. **Delete:** Deletes row if found; service throws if not found (handler does not map to **404**).

## Scenarios

### Success

- **GIVEN** campaigns **WHEN** GET `/` **THEN** **200** with `success`, `data`, `pagination`.
- **GIVEN** valid payload **WHEN** POST `/` **THEN** **201** and audit `CREATE_CAMPAIGN`.
- **GIVEN** draft campaign **WHEN** PATCH `/:id` **THEN** **200**.
- **GIVEN** sendable campaign **WHEN** POST `/:id/send` **THEN** **200** `{ sent, recipientCount }`.

### Failure

- **GIVEN** invalid promo or segment **WHEN** POST `/` **THEN** **400** with message (e.g. `"Invalid or inactive promo code"`, `"Segment not found"`).
- **GIVEN** active/completed campaign **WHEN** PATCH **THEN** **400** `"Only DRAFT or SCHEDULED..."`.
- **GIVEN** wrong status **WHEN** POST send **THEN** **400** `"cannot be sent"` (or full service message).
- **GIVEN** no auth **WHEN** any **THEN** **401**.
- **GIVEN** missing permission **WHEN** list/create/update/send **THEN** **403** (needs `CAMPAIGNS` read); delete needs **delete**.
- **404:** **GIVEN** unknown campaign **WHEN** PATCH `/:id` or POST `/:id/send` **THEN** service throws `"Campaign not found"`; handler catches and returns **400** `{ success: false, message }` (not **404** in current implementation); if the error were uncaught, response **may 500**.

## Edge Cases

- **RBAC:** Create/update/send require **read**, not `create`/`update`.
- **No segment/branch:** Send yields zero recipients but may still return **200** with zeros.
- **Delete handler:** Does not catch `"Campaign not found"` — may **500**.

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| GET `/`, POST `/`, PATCH `/:id`, POST `/:id/send` | `CAMPAIGNS` **read** |
| DELETE `/:id` | `CAMPAIGNS` **delete** |

## Dependencies

- **Prisma:** `campaign`, `promoCode`, `customerSegment`, `customerSegmentMember`, `transaction`, `auditLog`.
- **Internal:** `createNotificationService`, `CampaignService`.
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
