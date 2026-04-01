# Finance API

## Overview

Read-only financial analytics for authorized users: profit & loss style summary from branch daily snapshots and aggregates, void/discount audit lists from `auditLog`, payroll oversight listing, and tax summary from completed transactions.

**Base path:** `/api/finance`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pl` | Bearer + org + `FINANCE_REPORTS` read | P&L summary for `dateFrom`/`dateTo`, optional `branchId`. |
| GET | `/void-discount-audit` | Bearer + org + `FINANCE_REPORTS` read | `VOID_TRANSACTION` and `APPLY_DISCOUNT` audit rows for branch + range. |
| GET | `/payroll-oversight` | Bearer + org + `FINANCE_REPORTS` read | Up to 100 `PayrollPeriod` rows with optional filters. |
| GET | `/tax-summary` | Bearer + org + `FINANCE_REPORTS` read | Aggregate tax and net on **COMPLETED** transactions in range. |

## Business Rules

- **P&L (`getPLSummary`):** Revenue from `branchDailySnapshot` (service + product + tips); costs = sum of `staffEarning.commission` + **DISBURSED** `payrollPeriod.totalPayout` (with optional branch filter via nested staff/user — see Prisma where in service); `inventoryCOGS` fixed **0** in response; void/discount/tax totals from `transaction` aggregates; `grossMarginPercent` rounded to 2 decimals.
- **Branch scope guard (`/pl` handler):** If JWT `scope === "BRANCH"` and `branchId` query omitted → **403** `"Branch-scoped users must specify branchId"`.
- **Void/discount audit:** Totals derived from `details.amount` (voids) and `details.totalDiscount` (discounts) — may be 0 if shapes differ from writer.
- **Payroll oversight:** Optional `status`, `dateFrom`/`dateTo` on `periodStart` range.
- **Tax summary:** **COMPLETED** transactions only; optional `branchId`.

## Scenarios

### Success

- **GIVEN** HQ scope and valid dates **WHEN** `GET /pl` **THEN** `200` with `revenue`, `costs`, `grossProfit`, etc.
- **GIVEN** `branchId` + range **WHEN** `GET /void-discount-audit` **THEN** `200` with `voids`, `discounts`, totals.
- **GIVEN** filters **WHEN** `GET /payroll-oversight` **THEN** `200` with array (max 100).
- **GIVEN** range **WHEN** `GET /tax-summary` **THEN** `200` with `totalTax`, `totalNetRevenue`, `transactionCount`.

### Failure

- **GIVEN** no JWT **THEN** `401`.
- **GIVEN** missing `FINANCE_REPORTS` read **THEN** `403`.
- **GIVEN** `scope === "BRANCH"` and no `branchId` **WHEN** `GET /pl` **THEN** `403`.

## Edge Cases

- Snapshot/aggregate queries use inclusive date windows with `to` set end-of-day UTC in service.
- Branch filtering on earnings/payroll uses relation `staff.user.branchId` (matches implementation, not necessarily all org models).

## RBAC

All routes: `FINANCE_REPORTS` **read** (`finance.index.ts` applies to `*`).

## Dependencies

- **Prisma:** `branchDailySnapshot`, `staffEarning`, `payrollPeriod`, `transaction`, `auditLog`
- **Downstream data:** commissions, payroll, POS transactions, scheduled snapshot jobs (out of band)
