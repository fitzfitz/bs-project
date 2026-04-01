# API Feature: Referrals (`/api/referrals`)

## Overview

Customer referral codes on `CustomerMembership`, applying a code as referee, referral history for referrers, and org-wide stats for admins. Completion and bonus points are finalized elsewhere (`ReferralService.completeReferral` + `LoyaltyService.addBonusPoints`) when a referee’s first transaction completes.

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|----------------|-------------|
| GET | `/me/code` | Bearer + org scope | Return existing `referralCode` or generate + persist (upsert membership). |
| POST | `/apply` | Bearer + org scope | Create `Referral` row (`PENDING`) for referee using referrer’s code. |
| GET | `/me/history` | Bearer + org scope | Paginated referrals where current user is referrer. |
| GET | `/stats` | Bearer + org scope + `REFERRALS` **read** | Counts total/completed/pending + `conversionRate`. |

Mounted under `/api/referrals`.

## Business Rules

- **Code generation:** Prefix from first name (3 chars, pad `X`), suffix random 4 digits; retry up to 10 times for uniqueness within org on `CustomerMembership.referralCode`.
- **Apply:** Referrer resolved by code in same `organizationId` as referee. Cannot self-refer. One row per `(referrerId, refereeId)`; duplicate → **409** `"Referral already applied"`. Invalid code → **400**.
- **Stats:** `referral.count()` across entire DB — **not** filtered by `organizationId` in current implementation.

## Scenarios

### Success

- **GIVEN** logged-in customer **WHEN** GET `/me/code` **THEN** **200** `{ referralCode }`.
- **GIVEN** valid code and first-time referee **WHEN** POST `/apply` **THEN** **200** and referral DTO (`PENDING`).
- **GIVEN** referrer with rows **WHEN** GET `/me/history` **THEN** **200** with pagination and referee names.
- **GIVEN** admin with `REFERRALS` read **WHEN** GET `/stats` **THEN** **200** stats object.

### Failure

- **GIVEN** no auth **WHEN** customer routes **THEN** **401**.
- **GIVEN** no org context **THEN** **403**.
- **GIVEN** self-referral or invalid code **WHEN** POST `/apply` **THEN** **400**.
- **GIVEN** duplicate pair **WHEN** POST `/apply` **THEN** **409**.
- **GIVEN** no `REFERRALS` read **WHEN** GET `/stats` **THEN** **403**.

## Edge Cases

- **Stats scope:** Global counts may include other tenants — multi-tenant leak risk.
- **`getOrCreateReferralCode`:** Throws `"User not found"` if user missing (handler uncaught → **500**).

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| `/me/code`, `/apply`, `/me/history` | Authenticated + org scope |
| `/stats` | `REFERRALS` **read** |

## Dependencies

- **Prisma:** `user`, `customerMembership`, `referral`, `auditLog` (on complete).
- **Internal:** `LoyaltyService` (dynamic import on complete).
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
