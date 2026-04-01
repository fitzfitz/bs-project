# API: Audit

## Overview

Tenant-scoped audit visibility: paginated **audit log** listings (who did what, when, on which branch) and **anomaly flags** raised by automated checks or operations (e.g. excessive voids, high discounts, off-hours clock-in). Staff with `BRANCH` scope see logs and anomalies constrained to their `branchId` when they do not pass an explicit `branchId` filter. Anomaly statistics aggregate unresolved counts by severity and type. Resolution of a flag records the resolving user, timestamp, and optional notes inside `details`. Heavy **anomaly detection** (`AuditService.detectAnomalies`) runs on a scheduler and is not exposed as a public HTTP route.

## API Endpoints

Base path: `/api/audit` (mounted from `audit.index.ts`). All routes use `Authorization: Bearer <tenant JWT>` and `X-Org-Slug` with `authMiddleware`, `orgScopeMiddleware`, and `requirePermission("AUDIT_LOG", "read")` on the sub-router.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/logs` | Paginated audit log entries with optional filters and related `user` / `branch` includes. |
| GET | `/anomalies` | Paginated anomaly flags with optional filters and related `branch` / `user` includes. |
| GET | `/anomalies/stats` | Counts: total, unresolved, `bySeverity`, `byType` (unresolved only in groupings). Optional `branchId` query scopes stats. |
| PATCH | `/anomalies/{id}/resolve` | Mark anomaly resolved; body may include `notes` (stored in `details.resolutionNotes`). |

### Query parameters

- **`/logs`**: `branchId`, `userId`, `action`, `entityType`, `dateFrom`, `dateTo` (all optional strings); `page` (default `"1"`), `limit` (default `"50"`).
- **`/anomalies`**: `branchId`, `type`, `severity`, `isResolved` (optional; `isResolved` compared to string `"true"`); `page` (default `"1"`), `limit` (default `"20"`).
- **`/anomalies/stats`**: optional `branchId`.

## Business Rules

- **Org scope**: Prisma client is org-scoped by middleware; queries only see the current tenant’s `AuditLog` / `AnomalyFlag` rows.
- **Branch scope for callers**: If the caller’s JWT scope is `BRANCH` and `callerBranchId` is set, and no `branchId` filter is supplied, listings restrict to that branch (logs and anomalies). HQ (or explicit `branchId`) can target a specific branch or omit branch filter where allowed.
- **Log ordering**: Newest first (`createdAt` desc).
- **Anomaly ordering**: `severity` desc, then `createdAt` desc.
- **Date filters on logs**: `dateFrom` / `dateTo` apply to `createdAt` as inclusive-ish window (`gte` / `lte` on `Date` parsed from query strings).
- **Resolve anomaly**: Fails with **404** if flag missing; **400** if already resolved. On success, sets `isResolved`, `resolvedBy`, `resolvedAt`, merges `resolutionNotes` into `details`.
- **Scheduler-only detection** (reference): Creates flags for patterns such as ≥3 `VOID_TRANSACTION` audit actions in one hour per user/branch, discounts &gt;50% of gross from non-manager/non-HQ roles on `APPLY_DISCOUNT` logs (24h window), and `CLOCK_IN` outside `OperatingHour` open/close in WIB when hours exist for that weekday.

## Scenarios

### Success

- **GIVEN** authenticated user with `AUDIT_LOG` read **WHEN** GET `/logs` with valid pagination **THEN** `200` and `{ success: true, data: logs[], pagination }`.
- **GIVEN** `BRANCH` user **WHEN** GET `/logs` without `branchId` **THEN** results limited to `callerBranchId`.
- **GIVEN** `AUDIT_LOG` read **WHEN** GET `/anomalies` **THEN** `200` with paginated anomalies.
- **GIVEN** optional `branchId` on stats **WHEN** GET `/anomalies/stats` **THEN** `200` with `total`, `unresolved`, `bySeverity`, `byType`.
- **GIVEN** unresolved anomaly **WHEN** PATCH `/anomalies/{id}/resolve` with optional `notes` **THEN** `200` and updated anomaly including resolution metadata.

### Failure

- **GIVEN** no / invalid JWT **WHEN** any audit route **THEN** `401` / auth failure (middleware).
- **GIVEN** JWT without `AUDIT_LOG` read **WHEN** any audit route **THEN** `403`.
- **GIVEN** unknown anomaly id **WHEN** PATCH resolve **THEN** `404` and `{ success: false, message }` containing “not found”.
- **GIVEN** already resolved anomaly **WHEN** PATCH resolve **THEN** `400` and message indicating already resolved.

## Edge Cases

- Non-numeric `page` / `limit` strings coerce via `parseInt` to `NaN` in handlers, which can yield invalid `skip`/`take` in Prisma; clients should send numeric strings.
- `isResolved` on anomaly list only treats exact string `"true"` as resolved filter; other values leave the filter unset.
- `dateFrom` / `dateTo` rely on `Date` parsing of arbitrary strings; invalid dates produce invalid queries or empty results.
- Anomaly stats with `branchId` filter still count “unresolved” subsets only for the `bySeverity` / `byType` groupings (implementation groups unresolved rows only).

## RBAC

- **Feature**: `AUDIT_LOG`
- **Actions**: All HTTP routes above use **`read`** only (`requirePermission("AUDIT_LOG", "read")`), including PATCH resolve (as implemented in `audit.index.ts`).

## Dependencies

- **Middleware**: `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Prisma models**: `AuditLog`, `AnomalyFlag`, `User`, `Branch`, `OperatingHour` (detection), `TenantRole` (via user include for log context)
- **Downstream**: Scheduler invokes `AuditService.detectAnomalies` (not part of this router).
