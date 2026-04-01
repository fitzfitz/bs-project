# API: Analytics

## Overview

Tenant-scoped analytics: dashboards, branch comparison, peak-hour heatmaps, retention cohorts, revenue forecasts, demand forecasting (stored `DemandForecast` rows), smart scheduling (`ScheduleSuggestion`), churn risk (`ChurnScore`), staff utilization, and optional daily snapshot computation. Data is read from `BranchDailySnapshot`, `DemandForecast`, `BranchHoliday`, `ScheduleSuggestion`, `ShiftSchedule`, `ChurnScore`, `Transaction`, `QueueEntry`, `StaffAttendance`, `AnomalyFlag`, and related models. Dates are interpreted in UTC in the service layer; peak-hour heatmap buckets use WIB (UTC+7) for day/hour. A weekly scheduler job (Monday 04:00 UTC) recomputes churn scores for all active branches.

## API Endpoints

Base path: `/api/analytics` (mounted from `analytics.index.ts`). All routes require `Authorization: Bearer <tenant JWT>` and `X-Org-Slug` (via tenant auth flow). Prisma is org-scoped (and branch-scoped for `BRANCH` users) by middleware.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Global dashboard: per-branch metrics for a calendar day, totals, and top unresolved anomaly alerts. |
| GET | `/comparison` | Compare branches over a date range for a selected metric. |
| GET | `/heatmap` | Completed-transaction counts by WIB weekday × hour. |
| GET | `/retention` | Cohort retention for a `YYYY-MM` month. |
| GET | `/forecast` | Linear regression forecast of monthly revenue from daily snapshots (requires `branchId`). |
| GET | `/utilization` | Staff utilization from attendance + completed queue entries in a date range. |
| POST | `/snapshots/compute` | Recompute/upsert `BranchDailySnapshot` for all active branches for one UTC day. |
| GET | `/demand-forecast` | Read persisted demand forecasts for a branch; optional `dateFrom` / `dateTo` (ISO date strings). Response includes `forecasts` and `accuracy.mape` (MAPE % from last 7 days vs snapshots when data exists). |
| POST | `/demand-forecast/compute` | Recompute 14-day ahead forecasts from ~90 days of `BranchDailySnapshot` (time-series decomposition + holiday dampening). Body: optional `branchId`; if omitted, all active branches are processed. |
| GET | `/schedule-suggestions` | List scheduling suggestions for `branchId`; optional `weekStart` (ISO date) filters a 7-day window. |
| POST | `/schedule-suggestions/compute` | Replace suggestions for a branch from demand forecasts, shift coverage, and queue-derived service duration. |
| PATCH | `/schedule-suggestions/{id}` | Set status `ACCEPTED` or `REJECTED`; on accept with `staffProfileId`, creates `ShiftSchedule` (requires unique staff+date). |
| GET | `/churn-scores` | Paginated churn scores: `branchId`, optional `riskLevel`, `minScore`, `page`, `limit`. |
| POST | `/churn-scores/compute` | Recompute `ChurnScore` for customers with completed transactions at `branchId`. |
| GET | `/churn-scores/{customerId}` | Single customer churn row; requires `branchId` query. |

## Business Rules

- **Dashboard day**: Optional `date` query; otherwise “today” UTC. Branch rows include revenue/tx from snapshot, live queue length, clocked-in staff count, `isOpen` from `!isEmergencyClosed`.
- **Comparison**: `dateFrom` / `dateTo` required. `branchIds` optional comma-separated list; if omitted, all active branches are used. `metric` defaults to `revenue`; allowed values include `revenue`, `transactions`, `avgTicket`, `customerCount`, `rating` — implementation maps `rating` to `totalRevenue` (same as default) because snapshot field mapping has no dedicated rating metric key.
- **Forecast**: `branchId` required. `periods` coerced 1–12, default 3. If fewer than two months of snapshot history exist, returns empty forecast with zero slope/intercept.
- **Snapshots compute**: Aggregates completed transactions and queue sources for each active branch for the given UTC day (or today), upserts `BranchDailySnapshot`.
- **Demand forecast compute**: Requires at least 14 snapshot rows in the lookback window; otherwise writes nothing and returns `forecastDays: 0` for that branch. Upserts `DemandForecast` for the next 14 UTC calendar days. Holidays in `BranchHoliday` for that window reduce predicted revenue/transactions by 70%. Nightly scheduler runs demand forecast at 02:15 UTC after snapshots.
- **Demand forecast read**: Lists stored forecasts for `branchId`; MAPE compares `predictedRevenue` to `BranchDailySnapshot.totalRevenue` for overlapping days in the last 7 UTC days when both exist.
- **Retention**: `cohortMonth` must be parseable as `YYYY-MM` (split by `-`); invalid month parts yield empty or incorrect cohort windows — callers should pass valid ISO month strings.
- **Schedule suggestions compute**: Deletes existing suggestions for the branch, loads forecasts for the next 7 days (date window relative to now), derives average service minutes from recent completed/paid queue entries (or default 45), compares required hours vs scheduled non-leave shift hours, and creates suggestions when demand/capacity ratio is above 1.2 or (below 0.7 with scheduled hours).
- **Churn compute**: Groups completed transactions by `customerId` at the branch; upserts `ChurnScore` with weighted health features (recency, frequency, monetary, engagement). Returns aggregate `customersScored` and `riskDistribution`.
- **Churn list response**: `{ success, data[], pagination }` where each row includes `customerId`, name, email, `score`, `riskLevel`, `features`, `computedAt` (ISO string).

## Scenarios

### Success

- **GIVEN** authenticated user with `ANALYTICS` read permission **WHEN** GET `/dashboard` **THEN** `200` and `{ success: true, data }` with `date`, `branches`, `totals`, `alerts`.
- **GIVEN** valid comparison query **WHEN** GET `/comparison` **THEN** `200` with array of branch series including `dataPoints`, `total`, `average`.
- **GIVEN** valid `branchId` and history **WHEN** GET `/forecast` **THEN** `200` with `historical`, `forecast`, `slope`, `intercept`.
- **GIVEN** valid token **WHEN** POST `/snapshots/compute` **THEN** `200` with `branchesProcessed` and `date`.
- **GIVEN** valid `branchId` **WHEN** GET `/demand-forecast` **THEN** `200` with `{ success: true, data: { forecasts, accuracy } }`.
- **GIVEN** valid token **WHEN** POST `/demand-forecast/compute` with `{ "branchId": "<id>" }` **THEN** `200` with `branchesProcessed: 1` and `forecastDays` (0–14).
- **GIVEN** valid token **WHEN** POST `/demand-forecast/compute` with `{}` **THEN** `200` with `branchesProcessed` and `totalForecasts` across active branches.
- **GIVEN** no demand forecasts in the branch window **WHEN** POST `/schedule-suggestions/compute` **THEN** `200` with `{ success: true, data: { suggestionsCreated: 0 } }`.
- **GIVEN** computed churn rows **WHEN** GET `/churn-scores?branchId=…` **THEN** `200` with `success`, `data[]`, and `pagination`.
- **GIVEN** no stored churn row **WHEN** GET `/churn-scores/{customerId}?branchId=…` **THEN** `404` with `success: false` and a not-found message.

### Failure

- **GIVEN** no `Authorization` header **WHEN** any analytics route **THEN** `401` with unauthorized message (auth middleware).
- **GIVEN** valid JWT but role lacks `ANALYTICS` read **WHEN** any analytics route **THEN** `403` insufficient permissions.
- **GIVEN** JWT without organization context compatible with scope middleware **WHEN** any route **THEN** `403` no organization context (org scope middleware).

## Edge Cases

- No active branches: dashboard returns empty `branches` and zero totals; snapshot compute processes zero branches.
- Empty cohort: retention returns `{ cohortSize: 0, returnRates: [] }`.
- `branchIds` filter with empty string after split: treated as “all active branches”.
- Utilization: staff with attendance but no matching queue entries show `utilizationRate` 0 if `availableMinutes` is 0 after rounding edge cases.

## RBAC

- **Feature**: `ANALYTICS`
- **Action**: `read` on all routes (see `requirePermission("ANALYTICS", "read")` on the router).

## Dependencies

- **Middleware**: `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Prisma models**: `Branch`, `BranchDailySnapshot`, `DemandForecast`, `BranchHoliday`, `ScheduleSuggestion`, `ShiftSchedule`, `ChurnScore`, `StaffAttendance`, `QueueEntry`, `Transaction`, `AnomalyFlag`, `CustomerMembership`, `LoyaltyTransaction`, `Review`, `Referral`, etc.
- **Downstream**: None external; internal services only.
