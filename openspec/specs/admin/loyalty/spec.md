# Admin — Loyalty (API)

## Overview

The **loyalty** admin feature (frontend module) exposes **TanStack Query hooks** to read a customer’s membership, **adjust points**, **run expiry job**, and read **referral statistics**. There is **no widget** in this folder; consumers embed these hooks in pages or future UI.

## Components

- Page-level UI lives under `pages/loyalty/`; no shared widget folder in this feature.

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useCustomerMembership` | `GET /loyalty/:userId` | **Enabled** only when `userId` is truthy. `queryKey: ["admin-loyalty", userId]`. |
| `useAdjustPoints` | `PATCH /loyalty/admin/adjust` | Body: `{ userId, points, description }`. Invalidates `["admin-loyalty"]` on success. |
| `useExpirePoints` | `POST /loyalty/admin/expire` | Invalidates `["admin-loyalty"]` on success. |
| `useReferralStats` | `GET /referrals/stats` | `queryKey: ["admin-referral-stats"]`. |

### Types

- `CustomerMembership`: points, tier, multiplier, activity/expiry fields, optional nested `user`.
- `ReferralItem`, `ReferralStats`: referral program admin/list shapes.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/loyalty/page.tsx` | `useCustomerMembership`, `useAdjustPoints`, `useExpirePoints`, `useReferralStats` — lookup by user id, adjust points, run expiry job, referral stats section. |

## Business Rules

1. **`useCustomerMembership(userId)`** is **disabled** when `userId` is falsy (`enabled: !!userId`).
2. **`useAdjustPoints`** PATCHes `/loyalty/admin/adjust` and on success invalidates queries prefixed **`["admin-loyalty"]`**.
3. **`useExpirePoints`** POSTs `/loyalty/admin/expire` and on success invalidates **`["admin-loyalty"]`**.
4. **`useReferralStats`** uses key **`["admin-referral-stats"]`**; always fetches when mounted.
5. **RBAC:** **`LOYALTY`**; adjust/expiry are privileged — API must enforce update.

## Hook States

### Query hooks (`useCustomerMembership`, `useReferralStats`)

- **Loading:** GIVEN query enabled WHEN fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN `useCustomerMembership` with missing `userId` WHEN hook initializes THEN `enabled: false`, no membership fetch.
- **Success:** GIVEN success WHEN settled THEN `data` is `CustomerMembership` or `ReferralStats` envelope.

### Mutation hooks (`useAdjustPoints`, `useExpirePoints`)

- **Pending:** GIVEN mutate called WHEN request in flight THEN `isPending: true`.
- **Error:** GIVEN API rejects WHEN mutation fails THEN `isError: true`, surface error in page UI.
- **Success:** GIVEN success WHEN mutation resolves THEN **`["admin-loyalty"]`** queries invalidate (membership refetch for active user id).

## State

- **Server:** TanStack Query caches for membership and referral stats; mutations invalidate loyalty queries.

## User Interactions

- N/A at module level (hook-only). Callers provide UI for user id input, adjust form, and expiry confirmation.

## Scenarios

- **GIVEN** `userId` is undefined **WHEN** `useCustomerMembership` is mounted **THEN** no fetch occurs (`enabled: false`).
- **GIVEN** adjust mutation succeeds **WHEN** it completes **THEN** membership queries refetch (invalidation).
- **GIVEN** expire mutation succeeds **WHEN** it completes **THEN** loyalty queries invalidate.

## Edge Cases

- Concurrent adjusts: last write wins on server; UI should disable or debounce at caller level.
- Referral stats errors: surfaced via React Query error state on consumer.

## RBAC

- **`LOYALTY`** feature (read/update as applicable). Adjust/expiry are privileged operations — API must enforce **update**; customer-facing data must stay tenant-scoped.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
