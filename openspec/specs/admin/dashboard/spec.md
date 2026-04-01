# Feature: Admin Dashboard

## Overview

The admin dashboard is the landing page for the admin app. It provides two distinct views based on the user's permissions: a **Manager Dashboard** (DashboardOverview) for users with `TRANSACTION:canRead` permission showing daily revenue KPIs, and a **Barber Dashboard** for staff members showing their personal queue stats and upcoming clients. The page component (`DashboardPage`) acts as a router between the two based on RBAC.

## Components

### DashboardOverview (Manager View)
- Branch selector and date picker at the top
- 4 KPI cards: Total Revenue, Service Revenue, Product Revenue, Tips
- Payment methods breakdown with transaction count
- Auto-selects the first branch if none is selected

### BarberDashboard (Staff View)
- Personalized welcome message with the user's first name
- Branch selector (no date picker — always today)
- 3 stat cards: Active Queue count, Completed Today count, Today's Earnings entry count
- "Upcoming Clients" list showing active queue entries (WAITING, CALLED, IN_SERVICE) with customer name, services, and status badge
- Prompts to select a branch when none is selected

### DashboardPage (Router)
- Checks `hasPermission(permissions, "TRANSACTION", "canRead")`
- If true → renders `DashboardOverview`
- If false → renders `BarberDashboard`

## Hooks

| Hook | Endpoint | Key |
|------|----------|-----|
| `useDailySummary(branchId, date)` | `GET /transactions/summary?branchId=&date=` | `["transactions", "summary", branchId, date]` |
| `useBranches()` | `GET /branches` | `["branches"]` |
| `useQueue(params)` | `GET /queue?branchId=&date=&staffProfileId=` | `["queue", params]` |
| `useMyEarnings({ dateFrom, dateTo })` | `GET /commissions/me?dateFrom=&dateTo=` | (from commissions feature) |

## State

- `useBranchStore` (Zustand, persisted): `selectedBranchId` — shared across dashboard, POS, inventory
- `useSessionStore` (Zustand): `user.staffProfile.id`, `user.firstName`, `user.permissions`

## Business Rules

1. The manager view requires `TRANSACTION:canRead` permission; all other users see the barber view.
2. If no branch is selected and branches are loaded, auto-select the first one.
3. `useDailySummary` is disabled when `branchId` is empty (falsy).
4. The barber dashboard always uses today's date (ISO format `YYYY-MM-DD`).
5. Revenue and monetary values are formatted with `id-ID` locale.
6. Queue data on the barber dashboard is filtered by the staff's own `staffProfileId`.
7. Active entries: statuses `WAITING`, `CALLED`, `IN_SERVICE`.
8. Completed entries: statuses `COMPLETED`, `AT_CHECKOUT`, `PAID`.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/dashboard/page.tsx` | Chooses `DashboardOverview` vs `BarberDashboard` from permissions. |
| `widgets/dashboard-overview.tsx` | `useDailySummary`, `useBranches` (from `@/features/pos/api/use-branches`). |
| `widgets/barber-dashboard.tsx` | `useBranches`, `useQueue`, `useMyEarnings` (commissions feature). |

## Hook States

### Query hooks (`useDailySummary`)

- **Loading:** GIVEN `branchId` and `date` provided WHEN summary is fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN `/transactions/summary` fails WHEN query settles THEN `isError: true`, `error` contains message (overview shows destructive text).
- **Disabled:** GIVEN falsy `branchId` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `data` matches summary shape (counts, revenue fields, `paymentMethods`).

### Query hooks (`useBranches`)

- **Loading:** GIVEN hook mounted WHEN `/branches` fetching THEN `isLoading: true`.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`.
- **Disabled:** GIVEN N/A (always enabled) WHEN mounted THEN request runs.
- **Success:** GIVEN success THEN `data` is branch list for selector and auto-select logic.

### Query hooks (`useQueue`)

- **Loading:** GIVEN truthy `branchId` WHEN list fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API failure WHEN settled THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN falsy `branchId` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `data` is queue entries; barber dashboard passes `staffProfileId` and today’s date; query **refetches every 30s** while mounted.

### Query hooks (`useMyEarnings`)

- **Loading:** GIVEN params WHEN `/commissions/me` fetching THEN `isLoading: true`.
- **Error:** GIVEN failure WHEN settled THEN `isError: true`.
- **Disabled:** GIVEN N/A in hook implementation WHEN mounted THEN request runs.
- **Success:** GIVEN success THEN `data` is earnings rows for the staff member.

### Mutation hooks

- None on the dashboard feature’s own `api/use-daily-summary` module; POS `useBranches` is query-only here.

## Scenarios

### Scenario: Manager sees daily revenue KPIs

- **GIVEN** a user with `TRANSACTION:canRead` permission
- **WHEN** the dashboard page loads
- **THEN** `DashboardOverview` renders with branch selector, date input, and 4 KPI cards showing revenue data

### Scenario: Manager changes date

- **GIVEN** `DashboardOverview` is displayed with summary data
- **WHEN** the user changes the date input
- **THEN** `useDailySummary` refetches with the new date and KPI cards update

### Scenario: Summary API fails

- **GIVEN** the transactions/summary endpoint returns an error
- **WHEN** `DashboardOverview` renders
- **THEN** the error message is displayed in a destructive text element

### Scenario: Barber sees personal dashboard

- **GIVEN** a user without `TRANSACTION:canRead` permission and a selected branch
- **WHEN** the dashboard page loads
- **THEN** `BarberDashboard` renders with welcome message, queue stats, and upcoming clients

### Scenario: Barber has no branch selected

- **GIVEN** a barber user with no branch selected and no branches loaded
- **WHEN** `BarberDashboard` renders
- **THEN** a prompt "Select a branch to view your dashboard" is shown

### Scenario: Barber sees upcoming clients

- **GIVEN** a barber with an active queue containing entries
- **WHEN** the barber dashboard loads
- **THEN** active entries (WAITING, CALLED, IN_SERVICE) appear in the "Upcoming Clients" list with customer name, services, and status badge

## Edge Cases

- No branches available → branch selector is empty, summary hook is disabled
- All revenue values are zero → KPI cards show "0"
- No payment methods in summary → payment methods list is empty
- Walk-in customer (no customer record) → displays "Walk-in" in queue list
- Queue entry has services from `services` array or from `booking.items` → both paths handled
- Staff has no queue entries today → stat cards show 0, no "Upcoming Clients" section

## RBAC

| Permission | View |
|------------|------|
| `TRANSACTION:canRead` | Manager Dashboard (DashboardOverview) |
| Any other / no permission | Barber Dashboard |

## Dependencies

- `@/features/pos/api/use-branches` — branch list
- `@/features/queue/api/use-queue` — queue data for barber dashboard
- `@/features/commissions/api/use-earnings` — earnings data for barber dashboard
- `@/features/auth/store` — session user, permissions, `hasPermission`
- `@/store/use-branch-store` — shared branch selection state
- `@/components/branch-selector` — BranchSelector UI component
