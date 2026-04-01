# Admin — Audit Logs & Anomalies

## Overview

The **audit** feature provides a **two-tab viewer**: **Audit Logs** (filterable, paginated, expandable JSON details) and **Anomalies** (stats cards, resolved filter, list with resolve workflow and modal).

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/audit-viewer.tsx` | `AuditViewer` — tab switcher between logs and anomalies. |
| `AuditLogTab` | Filters: action, date range; `useAuditLogs`; expandable rows; pagination. |
| `AnomalyTab` | `useAnomalyStats`, `useAnomalies`, `useResolveAnomaly`; checkbox “Show resolved”; resolve modal. |
| `StatMini` | Small stat card for anomaly summary. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useAuditLogs` | `GET /audit/logs?...` | Filters: branch, user, action, entityType, dates, page, limit. |
| `useAnomalies` | `GET /audit/anomalies?...` | `isResolved` as string query param when provided. |
| `useAnomalyStats` | `GET /audit/anomalies/stats[?branchId]` | |
| `useResolveAnomaly` | `PATCH /audit/anomalies/:id/resolve` | Optional `notes`. Invalidates anomalies + stats. |

### Types

- `AuditLogEntry`, `AnomalyFlag`, `AnomalyStats` — see `api/use-audit.ts`.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/audit/page.tsx` | Renders `AuditViewer`. |
| `widgets/audit-viewer.tsx` | `useAuditLogs`, `useAnomalies`, `useAnomalyStats`, `useResolveAnomaly`. |

## Business Rules

1. **Audit logs** support filters (branch from store, user, action, entity type, date range, pagination); changing filters updates the `useAuditLogs` query key.
2. **Anomalies** list passes `isResolved` as a string query param only when the “show resolved” filter supplies it.
3. **Anomaly stats** may be scoped with optional `branchId` from `useBranchStore`.
4. **Resolve anomaly** sends optional `notes` on `PATCH` and on success invalidates **`anomalies`** and **`anomaly-stats`** queries.
5. **RBAC:** **`AUDIT_LOG`** read; resolve is a privileged write — enforced by API.

## Hook States

### Query hooks (`useAuditLogs`, `useAnomalies`, `useAnomalyStats`)

- **Loading:** GIVEN the query is enabled WHEN fetching THEN `isLoading: true` on initial load, `data` undefined until success.
- **Error:** GIVEN the API errors WHEN the query settles THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN N/A (queries always enabled with default `{}` params) WHEN mounted THEN requests run according to current filter params.
- **Success:** GIVEN success WHEN settled THEN `data` includes list payloads plus `pagination` where the API returns it; stats return `AnomalyStats`.

### Mutation hooks (`useResolveAnomaly`)

- **Pending:** GIVEN `mutate` is called WHEN the PATCH is in flight THEN `isPending: true`.
- **Error:** GIVEN the API rejects WHEN the mutation fails THEN `isError: true`, `error` surfaces to the modal/caller.
- **Success:** GIVEN resolve succeeds WHEN the mutation settles THEN queries with keys **`anomalies`** and **`anomaly-stats`** are invalidated.

## State

- **Local:** Tab, log filters, log page, expanded log id, anomaly page, showResolved, resolving id, resolve notes.
- **Client:** `selectedBranchId` scopes logs/stats/anomalies when set.

## User Interactions

1. **Logs:** Change action or dates → reset page to 1; click row toggles details `pre` JSON.
2. **Anomalies:** Toggle “Show resolved”; paginate; **Resolve** opens modal; submit calls mutation.
3. Timestamps displayed in **Asia/Jakarta** via `toLocaleString` (presentation layer).

## Scenarios

- **GIVEN** logs returned **WHEN** user expands row **THEN** details JSON visible.
- **GIVEN** unresolved anomaly **WHEN** user resolves with notes **THEN** PATCH called and modal closes on success.
- **GIVEN** no anomalies **WHEN** list empty **THEN** empty state with shield icon.

## Edge Cases

- System actor: logs show “System” when `user` null.
- Unknown action: fallback badge color.
- Stats `bySeverity` filtered to CRITICAL/HIGH for extra mini cards — other severities omitted from that row.

## RBAC

- **`AUDIT_LOG`** read; resolving anomalies likely **update** on same or related feature — API must enforce.

## Dependencies

- `@/store/use-branch-store`, `@tanstack/react-query`, `@/lib/api`, `lucide-react`.
