# Admin — Commissions

## Overview

Hooks and UI for **commission earnings** — org-wide listing (`useEarnings`) and **self-service** staff view (`useMyEarnings` → `/commissions/me`). `CommissionOverview` renders a paginated table for managers.

## Widgets

| Widget | Purpose |
|--------|---------|
| `CommissionOverview` | Uses `useEarnings({ page })`; table of barber, date, base, commission, tips, total; optional pagination footer. |

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useEarnings(params)` | `GET /commissions?staffProfileId&dateFrom&dateTo&page` |
| `useMyEarnings(params)` | `GET /commissions/me?...` (barber role) |

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/commissions/page.tsx` | Renders `CommissionOverview` with page prop. |
| `widgets/commission-overview.tsx` | `useEarnings({ page, ... })`. |
| `features/dashboard/widgets/barber-dashboard.tsx` | `useMyEarnings` for today’s earnings window (staff dashboard). |

## Business Rules

1. **`useEarnings`** builds query string from optional `staffProfileId`, `dateFrom`, `dateTo`, `page`; all filters participate in the React Query key.
2. **`useMyEarnings`** targets **`GET /commissions/me`** for barber-scoped data; key is `["commissions", "me", params]`.
3. **CommissionOverview** shows empty, error, and pagination UI based on query state and optional `pagination` on the response envelope.
4. **RBAC:** **`COMMISSION`** for org listing; **`/commissions/me`** is server-scoped to the authenticated service provider.

## Hook States

### Query hooks (`useEarnings`, `useMyEarnings`)

- **Loading:** GIVEN hook mounted WHEN fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN query settles THEN `isError: true`, `error` contains message (overview renders destructive text).
- **Disabled:** GIVEN N/A (no `enabled: false` in hooks) WHEN initialized THEN request runs immediately.
- **Success:** GIVEN success WHEN settled THEN `data` is `ApiResponse<StaffEarning[]>` shape expected by consumers.

### Mutation hooks

- None in `features/commissions/api/`.

## State

- React Query: `["commissions", params]`, `["commissions", "me", params]`.

## User Interactions

- Manager opens commissions page, changes page (via prop), reads table.
- Staff dashboard uses `useMyEarnings` elsewhere.

## Scenarios

### Overview loads data

- **GIVEN** MSW/API returns earnings rows  
- **WHEN** `CommissionOverview` mounts  
- **THEN** table lists rows with formatted numbers.

### Empty state

- **GIVEN** empty `data` array  
- **WHEN** overview renders  
- **THEN** “No earnings data found” appears.

### Error state

- **GIVEN** request failure  
- **WHEN** overview renders  
- **THEN** error message is shown.

## Edge Cases

- Staff name fallback: truncates `staffProfileId` if `staff` relation missing.
- Pagination block reads optional `pagination` on response object (may be undefined).

## RBAC

- **`COMMISSION`** (read for listings; `/commissions/me` scoped by server for service providers).

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
