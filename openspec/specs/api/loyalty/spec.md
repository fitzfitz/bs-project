# API Feature: Loyalty (`/api/loyalty`)

## Overview

Customer loyalty accounts (`CustomerMembership`): points balance, tier, earn/redeem rules, transaction history, and admin tools (view any user, manual expiry job, manual point adjustments). Earn/redeem math and tier thresholds live in `LoyaltyService` and are also invoked from POS/transaction flows outside this router.

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|----------------|-------------|
| GET | `/me` | Bearer + org scope | Current user’s loyalty row for the org (`findFirst` on `userId` + `organizationId`). |
| GET | `/me/history` | Bearer + org scope | Paginated `LoyaltyTransaction` rows for the membership; empty list if no membership. |
| POST | `/redeem` | Bearer + org scope | Redeem points against an existing `Transaction` (`netAmount` used for max-discount rule). |
| GET | `/:userId` | Bearer + org scope + `LOYALTY` **update** | Admin: fetch membership by `userId` (unique on `CustomerMembership`). |
| POST | `/admin/expire` | Bearer + org scope + `LOYALTY` **update** | Run inactivity expiry: zero balances with past `pointsExpiringAt`, write negative loyalty transactions. |
| PATCH | `/admin/adjust` | Bearer + org scope + `LOYALTY` **update** | Manual point delta for a user in the same org; optional audit log when admin id present. |

All routes are mounted under `/api/loyalty` (see `index.ts`).

## Request and response bodies

### GET `/me`

No request body.

**200**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "userId": "string",
    "pointsBalance": 0,
    "lifetimePoints": 0,
    "tier": "BRONZE | SILVER | GOLD | PLATINUM",
    "tierMultiplier": 1,
    "pointsExpiringAt": "string (ISO 8601) | null",
    "lastActivityAt": "string (ISO 8601) | null",
    "createdAt": "string (ISO 8601)"
  }
}
```

**404:** `{ "success": false, "message": "Loyalty account not found" }`

### GET `/me/history`

**Query:** `page` (int, default 1), `limit` (int, default 20, max 100).

**200**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "points": 0,
      "description": "string",
      "transactionId": "string | null",
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

*(If no membership for `userId` via `findUnique`, handler returns **200** with empty `data` and zeroed pagination.)*

### POST `/redeem`

**Request body:**

```json
{
  "points": 1,
  "transactionId": "string"
}
```

**200**

```json
{
  "success": true,
  "data": {
    "pointsRedeemed": 0,
    "discountAmount": 0
  }
}
```

**400:** `{ "success": false, "message": "Transaction not found" }` when `transactionId` does not exist.

### GET `/:userId` (admin)

**200:** same `data` shape as GET `/me`.

**404:** `{ "success": false, "message": "Account not found" }`

### POST `/admin/expire`

No request body.

**200**

```json
{
  "success": true,
  "data": {
    "accountsProcessed": 0,
    "totalExpired": 0
  }
}
```

### PATCH `/admin/adjust`

**Request body:**

```json
{
  "userId": "string",
  "points": 0,
  "description": "string (1–200 chars)"
}
```

**200:** `{ "success": true, "message": "Adjusted {points} points for user {userId}" }`

## Business Rules

1. **Earn rate:** Base points = `floor(netAmount / POINTS_EARN_RATE)`; `POINTS_EARN_RATE` defaults to `10_000` and is configurable via `ConfigService`. Multiplied by `tierMultiplier` on the account; no-op if computed points ≤ 0.
2. **Redeem rate:** `discountAmount = points * POINTS_REDEEM_RATE`; `POINTS_REDEEM_RATE` defaults to `500` and is configurable via `ConfigService`. Cannot exceed **50%** of bill `netAmount`.
3. **Redeem balance:** `pointsBalance` must be ≥ points requested; otherwise error from service.
4. **Tier upgrade:** After earn/bonus, `lifetimePoints` drives tier (`BRONZE` / `SILVER` / `GOLD` / `PLATINUM`); upgrades write `auditLog` `TIER_UPGRADE`.
5. **Expiry (scheduled):** `processPointExpiry` targets memberships with `pointsExpiringAt <= now`, `pointsBalance > 0`; sets balance to 0, clears `pointsExpiringAt`, logs negative transaction.
6. **Adjust:** Target user must exist; if caller passes `callerOrganizationId`, it must match the user’s `organizationId`. Positive adjustments increment `lifetimePoints`; negative do not reduce lifetime (only balance).
7. **Redeem handler:** Loads `Transaction` by id; missing transaction → **400** `"Transaction not found"`. Service errors from redeem (e.g. insufficient points, cap) are **not** caught in the handler and may surface as **500** via global error handling.

## Scenarios

### Success

- **GIVEN** a `CustomerMembership` for JWT user and org **WHEN** GET `/me` **THEN** **200** and `data` includes `pointsBalance`, `tier`, ISO timestamps.
- **GIVEN** membership with transactions **WHEN** GET `/me/history?page=1&limit=20` **THEN** **200**, `data` array and `pagination` match query.
- **GIVEN** no membership **WHEN** GET `/me/history` **THEN** **200** with empty `data` and zero totals.
- **GIVEN** valid transaction and sufficient points under 50% cap **WHEN** POST `/redeem` **THEN** **200** and `data` has `pointsRedeemed`, `discountAmount`.
- **GIVEN** admin with `LOYALTY` update and existing membership **WHEN** GET `/:userId` **THEN** **200**.
- **GIVEN** admin with `LOYALTY` update **WHEN** POST `/admin/expire` **THEN** **200** and `data.accountsProcessed`, `data.totalExpired`.
- **GIVEN** admin with `LOYALTY` update and valid body **WHEN** PATCH `/admin/adjust` **THEN** **200** success message.

### Failure

- **GIVEN** no membership for user+org **WHEN** GET `/me` **THEN** **404** `"Loyalty account not found"`.
- **GIVEN** admin and no membership for `userId` **WHEN** GET `/:userId` **THEN** **404** `"Account not found"`.
- **GIVEN** unknown `transactionId` **WHEN** POST `/redeem` **THEN** **400** `"Transaction not found"`.
- **GIVEN** no/invalid Bearer **WHEN** any protected route **THEN** **401** (auth middleware).
- **GIVEN** JWT without org context **WHEN** customer/admin loyalty route **THEN** **403** (org scope).
- **GIVEN** user without `LOYALTY` update **WHEN** admin routes **THEN** **403** (RBAC).
- **GIVEN** adjust target user in another org **WHEN** PATCH `/admin/adjust` **THEN** service throws `"User not in same organization"` (handler uncaught → likely **500**).
- **409:** **N/A** — no unique constraints surfaced as **409** on loyalty endpoints.

## Edge Cases

- **GET `/me` vs history:** `/me` scopes by `organizationId`; `/me/history` uses `findUnique({ where: { userId } })` only (first global membership) — inconsistent if multiple orgs ever share users.
- **Redeem:** Uses `Transaction.netAmount` only; does not re-validate org/branch on the transaction in the handler.
- **Promotions `/validate-loyalty`:** Separate validation path with similar but not identical rules; clients may see different caps vs actual redeem.

## RBAC

| Area | Requirement |
|------|-------------|
| `/me`, `/me/history`, `/redeem` | `authMiddleware` + `orgScopeMiddleware` (no feature permission) |
| `/:userId`, `/admin/expire`, `/admin/adjust` | `LOYALTY` **update** |

## Dependencies

- **Prisma:** `user`, `customerMembership`, `loyaltyTransaction`, `transaction`, `auditLog`.
- **Internal:** `LoyaltyService` (used by transactions/referrals as well).
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
