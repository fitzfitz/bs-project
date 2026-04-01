# Admin — Analytics Dashboard

## Overview

The **analytics** feature is a **tabbed dashboard** (Overview, Comparison, Peak Hours, Retention, Utilization) that composes multiple analytics API hooks. **Branch context** from `useBranchStore` is passed into branch-aware tabs (heatmap, retention, utilization).

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/analytics-dashboard.tsx` | `AnalyticsDashboard` — tab bar, delegates to inner tab components. |
| (internal) `OverviewTab` | `useGlobalDashboard(dateFrom)` — KPI cards, per-branch cards, alerts. Refetch interval 60s on hook. |
| `ComparisonTab` | `useBranchComparison` with `metric: "revenue"` — horizontal bar chart style list. |
| `HeatmapTab` | `usePeakHeatmap` — 7×24 grid from `data.heatmap`. |
| `RetentionTab` | `useRetention` with **current month** `cohortMonth` (`YYYY-MM`). |
| `UtilizationTab` | `useUtilization` — overall stats + per-barber bars with color thresholds. |

## Hooks (`api/`)

| Hook | Endpoint | Notes |
|------|----------|-------|
| `useGlobalDashboard` | `GET /analytics/dashboard?date` | `refetchInterval: 60_000` |
| `useBranchComparison` | `GET /analytics/comparison?...` | `metric`, optional `branchIds` CSV |
| `usePeakHeatmap` | `GET /analytics/heatmap?...` | Optional `branchId` |
| `useRetention` | `GET /analytics/retention?cohortMonth[&branchId]` | |
| `useUtilization` | `GET /analytics/utilization?dateFrom&dateTo[&branchId]` | Typed `UtilizationData` |

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/analytics/page.tsx` | Renders `AnalyticsDashboard` with date range props. |
| `widgets/analytics-dashboard.tsx` | `useGlobalDashboard`, `useBranchComparison`, `usePeakHeatmap`, `useRetention`, `useUtilization` (per tab). |

## Business Rules

1. **Overview tab** calls `useGlobalDashboard(dateFrom)` only; `dateTo` from the page is not passed to that hook in the current UI.
2. **Comparison tab** uses `useBranchComparison` with `metric: "revenue"` and the dashboard’s `dateFrom` / `dateTo`.
3. **Heatmap, retention, utilization** optionally append `branchId` from `useBranchStore` when the user has selected a branch.
4. **Retention** uses the **current calendar month** as `cohortMonth` (`YYYY-MM`).
5. **Overview** data refetches automatically every **60 seconds** while the query is active.
6. **RBAC:** analytics read is gated by **`ANALYTICS`**; HQ vs branch data is enforced server-side from JWT claims.

## Hook States

### Query hooks (`useGlobalDashboard`, `useBranchComparison`, `usePeakHeatmap`, `useRetention`, `useUtilization`)

- **Loading:** GIVEN the tab that mounts the hook is active WHEN the query is fetching THEN the hook returns `isLoading: true` (and `isFetching: true` on first load), `data` is undefined until settled.
- **Error:** GIVEN the API returns an error WHEN the query settles THEN the hook returns `isError: true` and `error` carries the failure (consumers show empty/error UI as implemented per tab).
- **Disabled:** GIVEN N/A for these hooks (all are always `enabled: true` when mounted) WHEN the hook runs THEN a request is made; inactive tabs unmount and do not fetch until selected again.
- **Success:** GIVEN a successful envelope WHEN the query settles THEN `data` matches the API response shape (`GlobalDashboardData`, comparison rows, heatmap payload, retention payload, or `UtilizationData` respectively).

### Mutation hooks

- None in this feature’s `api/` folder.

## State

- **Local:** Active tab (`useState`).
- **Client:** `selectedBranchId` from `@/store/use-branch-store`.
- **Server:** Independent query caches per hook/tab.

## User Interactions

1. Click tab → mount corresponding subtree → queries run per hook rules.
2. Overview shows alerts with severity-based styling (CRITICAL/HIGH/default).

## Scenarios

- **GIVEN** overview API returns totals and branches **WHEN** tab active **THEN** stat cards and branch cards render.
- **GIVEN** user switches to Utilization **WHEN** data loaded **THEN** overall rate and barber rows show.
- **GIVEN** heatmap data missing `heatmap` **WHEN** loaded **THEN** “No heatmap data.”

## Edge Cases

- `OverviewTab` receives `dateTo` prop but only passes `dateFrom` to `useGlobalDashboard` (current implementation).
- Comparison bar width uses `Math.max` over totals; empty list handled with “No comparison data.”
- Utilization bar colors: green ≥80%, yellow ≥50%, else red.

## RBAC

- **`ANALYTICS`** read. HQ vs branch visibility enforced by API from JWT claims.

## Dependencies

- `@/store/use-branch-store`, `@tanstack/react-query`, `@/lib/api`.
