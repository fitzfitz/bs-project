# Admin — Payroll Periods

## Overview

The **payroll** feature lists **payroll periods** with staff name (or profile id fallback), period range, payout amount, and **status badge**, with optional **pagination** summary.

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/payroll-manager.tsx` | `PayrollManager` — accepts `page`, renders table and pagination line from API envelope. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `usePayrollPeriods` | `GET /payroll?staffProfileId&status&page` | Query key `["payroll", params]`. |

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/payroll/page.tsx` | Renders `PayrollManager` with `page` prop. |
| `widgets/payroll-manager.tsx` | `usePayrollPeriods({ page })`. |

## Business Rules

1. Query string includes only defined filter params (`staffProfileId`, `status`, `page`); all participate in **`["payroll", params]`**.
2. Table shows loading, error, empty, and pagination footer based on query state and optional `pagination` on the response.
3. **RBAC:** **`PAYROLL`** read for listing.

## Hook States

### Query hooks (`usePayrollPeriods`)

- **Loading:** GIVEN hook mounted WHEN `/payroll` fetching THEN `isLoading: true`, centered loading text in widget.
- **Error:** GIVEN API failure WHEN settled THEN `isError: true`, destructive `error.message`.
- **Disabled:** GIVEN N/A (no `enabled: false`) WHEN initialized THEN request runs.
- **Success:** GIVEN success WHEN settled THEN `data` matches payroll period rows + optional `pagination`.

### Mutation hooks

- None in `features/payroll/api/`.

## State

- **Server:** List + pagination from API (`data`, `pagination` on unwrapped envelope).

## User Interactions

1. **Load:** Centered “Loading...” text.
2. **Error:** Destructive message with `error.message`.
3. **Empty:** “No payroll periods found” row.
4. **Data:** Rows with formatted payout (`toLocaleString("id-ID")`), humanized status labels.

## Scenarios

- **GIVEN** API returns items **WHEN** loaded **THEN** table shows barber column, period, payout, status badge.
- **GIVEN** staff nested object missing **WHEN** row renders **THEN** truncated `staffProfileId` is shown.
- **GIVEN** pagination present **WHEN** `totalPages > 1` context **THEN** footer shows page x of y and total (widget shows summary whenever `pagination` exists).

## Edge Cases

- Unknown `status` values: falls back to muted badge class.
- `pagination` undefined: no footer block.

## RBAC

- **`PAYROLL`** read for listing; approve/disburse flows would be separate API/UI. Reference `docs/rbac_system.md`.

## Bulk Operations

### Hooks

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useBulkApprovePayroll` | `POST /payroll/bulk-approve` | Mutation, invalidates `["payroll"]` on success. |
| `useBulkDisbursePayroll` | `POST /payroll/bulk-disburse` | Mutation, invalidates `["payroll"]` on success. |

### UI Changes (`PayrollManager`)

- **Checkbox column:** Each row has a checkbox. Header checkbox toggles all visible rows.
- **Selection state:** Local `useState<Set<string>>` for selected period ids.
- **Bulk action toolbar:** Shown when `selectedIds.size > 0`. Contains:
  - "Approve Selected" button — enabled when all selected have status `PENDING_APPROVAL`
  - "Disburse Selected" button — enabled when all selected have status `APPROVED`
- **After mutation success:** Clear selection, show toast with count.
- **RBAC:** Buttons respect `PAYROLL` update permission (same as single actions).

### Bulk Scenarios

- **GIVEN** 3 rows selected with status PENDING_APPROVAL **WHEN** "Approve Selected" clicked **THEN** mutation fires, on success toast "3 periods approved", selection cleared.
- **GIVEN** mixed statuses selected **WHEN** toolbar renders **THEN** both buttons disabled (cannot approve non-PENDING_APPROVAL, cannot disburse non-APPROVED).

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
