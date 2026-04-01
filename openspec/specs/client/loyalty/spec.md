# Client — Loyalty

## Overview

Customer-facing **loyalty and referrals**: account summary, points history (paginated), referral code, and referral history. All authenticated queries are **gated on `useSessionStore().user`**. The **LoyaltyDashboard** widget composes hooks and presentational components for tier, progress, share, and history.

## Business Rules

1. **Authentication gate:** `useLoyaltyAccount`, `useLoyaltyHistory`, `useReferralCode`, and `useReferralHistory` set `enabled: !!user` from `useSessionStore`; without a session user, none of these queries fetch.
2. **Account:** `useLoyaltyAccount` uses `GET /loyalty/me` with query key `["loyalty", "account", user?.id]`.
3. **Points history:** `useLoyaltyHistory(page, limit)` calls `GET /loyalty/me/history?page&limit` with `placeholderData: keepPreviousData` for stable paging UI.
4. **Referral code:** `useReferralCode` calls `GET /referrals/me/code`; response envelope contains `referralCode`.
5. **Referral history:** `useReferralHistory(page, limit)` calls `GET /referrals/me/history?page&limit` with `keepPreviousData` like loyalty history.
6. **Parent responsibility:** Screens should not assume dashboard “loaded” when `user` is null—hooks stay idle until login.

## Components / Widgets

| Piece | Purpose |
|-------|---------|
| `LoyaltyDashboard` | Orchestrates `useLoyaltyAccount`, `useLoyaltyHistory`, `useReferralCode`, `useReferralHistory`; loading skeleton; error state; renders card, progress, referral card, points list. |
| `LoyaltyCard` | Visual membership card: tier color, multiplier, balance, currency equivalent via `POINTS_VALUE` and org currency from session, optional expiry line. |
| `TierProgressBar` | Lifetime points vs `TIER_THRESHOLDS` / `TIER_ORDER`; progress to next tier or max tier message. |
| `PointsHistoryList` | Transaction rows (earn/redeem), empty state, pagination when `totalPages > 1`. |
| `ReferralShareCard` | Loading skeleton; copy code; Web Share API or WhatsApp fallback; optional recent referrals preview. |

## Hooks (`api/`)

| Hook | Endpoint | Enabled |
|------|----------|---------|
| `useLoyaltyAccount` | `GET /loyalty/me` | `!!user` |
| `useLoyaltyHistory` | `GET /loyalty/me/history?page&limit` | `!!user`; `keepPreviousData` for paging |
| `useReferralCode` | `GET /referrals/me/code` | `!!user` |
| `useReferralHistory` | `GET /referrals/me/history?page&limit` | `!!user`; `keepPreviousData` |

## Hook States

### `useLoyaltyAccount`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** `GET /loyalty/me` is in flight  
  - **THEN** `isPending` / `isFetching` indicate loading.

- **Error**  
  - **GIVEN** the account request fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are set for dashboard error UI.

- **Disabled**  
  - **GIVEN** `user` is null/undefined  
  - **WHEN** the hook evaluates  
  - **THEN** `enabled` is false and no loyalty request runs.

- **Success**  
  - **GIVEN** logged-in user and success  
  - **WHEN** data resolves  
  - **THEN** query data is the full API response; UI reads membership from the envelope.

### `useLoyaltyHistory(page, limit)`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** a page changes or initial fetch runs  
  - **THEN** `isFetching` may be true; `keepPreviousData` keeps prior page visible while refetching.

- **Error**  
  - **GIVEN** history request fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` surface.

- **Disabled**  
  - **GIVEN** no `user`  
  - **WHEN** the hook runs  
  - **THEN** query is disabled.

- **Success**  
  - **GIVEN** success  
  - **WHEN** settled  
  - **THEN** response includes history items and pagination metadata as returned by the API envelope.

### `useReferralCode`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** code endpoint is fetching  
  - **THEN** loading state supports referral card skeleton.

- **Error**  
  - **GIVEN** code fetch fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are available.

- **Disabled**  
  - **GIVEN** no `user`  
  - **WHEN** evaluated  
  - **THEN** `enabled` is false.

- **Success**  
  - **GIVEN** success  
  - **WHEN** data resolves  
  - **THEN** envelope includes `referralCode` for copy/share.

### `useReferralHistory(page, limit)`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** paging or initial load runs  
  - **THEN** `isFetching` with `keepPreviousData` behaves like loyalty history.

- **Error**  
  - **GIVEN** referral history fails  
  - **WHEN** the query errors  
  - **THEN** error state is exposed.

- **Disabled**  
  - **GIVEN** no `user`  
  - **WHEN** evaluated  
  - **THEN** query is disabled.

- **Success**  
  - **GIVEN** success  
  - **WHEN** settled  
  - **THEN** referral history items and pagination come from the API response.

## State

- Local UI state in `LoyaltyDashboard` (`historyPage`). Referral share uses `useState` for “copied” feedback.

## Types (`types/index.ts`)

- **`CustomerMembership`**, **`LoyaltyTransaction`**, **`ReferralHistoryItem`**, tier enums, **`TIER_THRESHOLDS`**, **`TIER_MULTIPLIERS`**, **`TIER_ORDER`**, **`TIER_COLORS`**, **`POINTS_VALUE`**.

## User Interactions

- View tier and points on the card.
- Page through points history.
- Copy or share referral code; see completed referral count and preview list.

## Scenarios

### Dashboard with account

- **GIVEN** logged-in user and successful `/loyalty/me`  
- **WHEN** the dashboard loads  
- **THEN** `LoyaltyCard` and `TierProgressBar` show membership data.

### Account load error

- **GIVEN** `/loyalty/me` fails  
- **WHEN** the dashboard renders  
- **THEN** an error message is shown instead of the main content.

### Points pagination

- **GIVEN** `pagination.totalPages > 1`  
- **WHEN** the user clicks Next  
- **THEN** `onPageChange` increments page and history refetches.

### Referral copy

- **GIVEN** a referral code loaded  
- **WHEN** the user clicks copy  
- **THEN** clipboard receives the code and UI shows transient success.

## Edge Cases

- **Not logged in:** All four hooks stay disabled; dashboard shows loading until account query resolves—if `user` is null, account query never runs (parent should avoid mounting or handle elsewhere).
- **Referral card loading:** Skeleton while `useReferralCode` is loading or code missing.
- **Share API:** User cancel or failure falls back to copy (in Web Share path) or WhatsApp URL when `navigator.share` is absent.
- **Tier progress math:** Edge lifetime points below current tier threshold still clamp per component logic; PLATINUM shows 100% progress.

## Dependencies

- `@tanstack/react-query`, `axios` (`@/lib/api`), `@/features/auth/store`, `lucide-react`, UI `Button`.

## Public exports (`index.ts`)

- Re-exports hooks and types for consumers outside the feature folder.
