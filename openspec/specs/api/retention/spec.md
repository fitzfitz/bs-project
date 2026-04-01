# API: Retention (`/api/retention`)

## Overview

Operational hooks for **retention nudges**: manually run the same processing used for scheduled jobs — **at-risk** customers (last **COMPLETED** transaction in the **30–60 days ago** window) and **points expiry** warnings (`pointsExpiringAt` within **7 days**, `pointsBalance > 0`). Sends push notifications where eligible and records **`auditLog`** rows. **Cooldown:** skip sending if the user was nudged within the last **14 days** (see audit check). **Stats** aggregate `auditLog` rows with `entityType: RetentionNudge`.

There is **no** `retention.schema.ts`; OpenAPI shapes are inline in `retention.handlers.ts`.

**Base path:** `/api/retention` (`retention.index.ts`). Both routes require **`RETENTION` read**.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trigger` | Run `RetentionService.processRetentionTriggers` with app notification service. |
| GET | `/stats` | Counts of nudge audit rows (all time + last 30 days). |

---

### POST `/trigger`

**Request**

- **Headers:** `Authorization: Bearer <JWT>`, org scope headers.
- **Body:** none (no JSON schema).

**Response `200`**

```json
{
  "success": true,
  "data": {
    "atRiskSent": 0,
    "expirySent": 0
  }
}
```

- **`atRiskSent`:** number of at-risk nudges **sent** (push + audit recorded) in this run — users skipped by cooldown are not counted.
- **`expirySent`:** same for points-expiry nudges.

---

### GET `/stats`

**Request**

- **Headers:** `Authorization: Bearer <JWT>`, org scope headers.
- **Query:** none.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "totalNudges": 0,
    "last30Days": 0
  }
}
```

- **`totalNudges`:** `auditLog` count where `entityType === "RetentionNudge"` (no additional filter in service).
- **`last30Days`:** same filter plus `createdAt >= now - 30 days`.

## Business Rules

1. **Cooldown (14 days):** Before sending, `wasNudgedRecently` checks `auditLog` for `userId`, `action: "CREATE"`, `entityType: "RetentionNudge"`, `createdAt` within the last **14 days**; if found, that user is skipped for this run.
2. **At-risk cohort:** `transaction.groupBy` by `customerId` where `status: COMPLETED`, `_max.createdAt` in **[sixtyDaysAgo, thirtyDaysAgo]** (inclusive) — i.e. last visit between **30 and 60 days** before “now”.
3. **Expiry cohort:** `customerMembership` rows with `pointsExpiringAt` in **[now, now + 7 days]** and `pointsBalance > 0`.
4. **Per send:** After a successful push, `recordNudge` creates `auditLog` with `action: "CREATE"`, `entityType: "RetentionNudge"`, `entityId: userId`, `details: { type, sentAt }`, and `organizationId` from the user (at-risk) or membership (expiry).
5. **RBAC:** **POST** `/trigger` and **GET** `/stats` both require **`RETENTION` read** (trigger is not a separate `update` permission).
6. **Stats scope:** `getStats` counts audit rows **only** by `entityType` (and date for `last30Days`) — **not** filtered by `organizationId` in the current implementation.

## Scenarios (GWT)

### `200`

- **GIVEN** valid JWT, org scope, and `RETENTION` **read** **WHEN** POST `/trigger` **THEN** `200` with `success: true` and `data: { atRiskSent, expirySent }`.
- **GIVEN** same **WHEN** GET `/stats` **THEN** `200` with `success: true` and `data: { totalNudges, last30Days }`.

### `400`

- **N/A** — no request body or query validation on these routes; malformed requests are handled at framework layer if applicable.

### `401`

- **GIVEN** missing or invalid Bearer **WHEN** POST `/trigger` or GET `/stats` **THEN** `401`.

### `403`

- **GIVEN** valid JWT but missing `RETENTION` **read** **WHEN** either route **THEN** `403`.
- **GIVEN** org scope failure **WHEN** either route **THEN** `403` (or middleware-defined denial).

### `404`

- **N/A** — no path parameters or resource lookups returning `404`.

### `409`

- **N/A** — no conflict responses.

### `201`

- **N/A** — trigger returns `200`, not `201`.

## Edge Cases

- **Audit `action: CREATE`:** Reused for nudge logging; queries **must** filter on `entityType: RetentionNudge` to avoid mixing with unrelated creates.
- **At-risk `organizationId`:** Taken from `user.organizationId` when recording nudge; users missing from DB are skipped.
- **Stats vs tenant:** `totalNudges` / `last30Days` are **global** across all orgs unless the implementation is changed to scope by `organizationId`.
- **Concurrent triggers:** No distributed lock; duplicate runs can race (cooldown reduces duplicate sends per user).

## RBAC

| Route | Feature | Action |
|-------|---------|--------|
| POST `/trigger` | `RETENTION` | **read** |
| GET `/stats` | `RETENTION` | **read** |

## Dependencies

- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Prisma:** `transaction` (groupBy), `user`, `customerMembership`, `auditLog`
- **Internal:** `RetentionService.processRetentionTriggers`, `RetentionService.getStats`, `createNotificationService`
- **Notifications:** push delivery via notification service from `c.env`
