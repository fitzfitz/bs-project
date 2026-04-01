# Admin — Finance (P&L Overview)

## Overview

The **finance** feature surfaces **profit & loss style summaries** for a selected date range, optionally filtered by **branch** via the global branch store. It highlights revenue, gross profit, costs, PPN, voids, and discounts.

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/finance-overview.tsx` | `FinanceOverview` — reads `selectedBranchId` from `useBranchStore`, calls `usePLSummary`, renders stat cards, revenue/cost breakdown bars, void and discount panels. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `usePLSummary` | `GET /finance/pl?dateFrom&dateTo[&branchId]` | Query key includes options object. |
| `useVoidDiscountAudit` | `GET /finance/void-discount-audit?...` | **Enabled** only when `branchId` is set. |
| `useTaxSummary` | `GET /finance/tax-summary?...` | Optional `branchId`. |

### Types (`api/use-finance.ts`)

- `PLSummary`: period, revenue breakdown, costs, `grossProfit`, margins, taxes, `discountsGiven`, `voidsTotal`.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/finance/page.tsx` | Renders `FinanceOverview` with date range. |
| `widgets/finance-overview.tsx` | `usePLSummary` only today; **`useVoidDiscountAudit`** / **`useTaxSummary`** live in the same module for other consumers. |

## Business Rules

1. **`usePLSummary`** always runs when mounted with `dateFrom` / `dateTo`; optional `branchId` from `useBranchStore` is appended when set (org-wide when omitted).
2. **`useVoidDiscountAudit`** is **enabled only when `branchId` is truthy** (`enabled: !!opts.branchId`).
3. **`useTaxSummary`** accepts optional `branchId` like P&L; no extra `enabled` guard beyond params.
4. **RBAC:** **`FINANCE_REPORTS`** read; API enforces tenant and permissions.

## Hook States

### Query hooks (`usePLSummary`, `useTaxSummary`)

- **Loading:** GIVEN required date params WHEN fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN N/A (both enabled whenever mounted with string dates) WHEN initialized THEN request proceeds.
- **Success:** GIVEN success WHEN settled THEN `data` matches `PLSummary` or tax-summary envelope.

### Query hooks (`useVoidDiscountAudit`)

- **Loading:** GIVEN `branchId` truthy WHEN fetching THEN `isLoading: true`.
- **Error:** GIVEN API failure WHEN settled THEN `isError: true`.
- **Disabled:** GIVEN missing/empty `branchId` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `data` matches void/discount audit response.

### Mutation hooks

- None in `features/finance/api/`.

## State

- **Server:** TanStack Query for P&L (and other hooks when used elsewhere).
- **Client:** Branch selection from `@/store/use-branch-store` (persisted).

## User Interactions

1. **Load:** Skeleton while `usePLSummary` is loading.
2. **View:** Numeric values formatted with `toLocaleString()` (IDR-style display in labels).
3. **Profit styling:** Negative gross profit uses red highlight on card.

## Scenarios

- **GIVEN** API returns `PLSummary` **WHEN** load completes **THEN** four top cards and two breakdown sections render with correct totals.
- **GIVEN** response has no `data` **WHEN** load completes **THEN** “No financial data available for this period.” is shown.
- **GIVEN** `selectedBranchId` is set **WHEN** query runs **THEN** `branchId` is appended to query string.

## Edge Cases

- `totalCosts` zero: cost `BarRow` uses `total || 1` to avoid division by zero.
- Missing `branchId`: query still runs for org-wide P&L (parameter omitted).

## RBAC

- Maps to **`FINANCE_REPORTS`** (read) in `docs/rbac_system.md`. Page-level guard should require read access; API enforces tenant + permissions.

## Dependencies

- `@/store/use-branch-store`, `@tanstack/react-query`, `@/lib/api`, `lucide-react`.
