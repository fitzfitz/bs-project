# Commissions API

## Overview

Computes and stores daily `StaffEarning` from completed transactions (service revenue as commission base, tips per branch `tipDistribution`), lists earnings with pagination, and exposes staff self-service (`/me`) for own earnings. Recalculate deletes the day’s earning then recomputes.

**Base path:** `/api/commissions`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | Bearer + org + **staff** (`requireStaff`) | Paginated earnings for JWT user’s `staffProfile`; query like list minus `staffProfileId`. |
| POST | `/calculate` | Bearer + org + `COMMISSION` **create** | Upsert `StaffEarning` for `staffProfileId` + `date` (YYYY-MM-DD). |
| POST | `/recalculate` | Bearer + org + `COMMISSION` **update** | Delete then recalculate same. |
| GET | `/` | Bearer + org + `COMMISSION` **read** | Paginated earnings; optional `staffProfileId`, `dateFrom`, `dateTo`. |
| GET | `/{staffProfileId}` | Bearer + org + `COMMISSION` **read** | Earnings for one staff; query: dates, pagination. |

## Business Rules

- **Commission base:** Sum of `(unitPrice * quantity - discount)` for line items with `serviceId` on **COMPLETED** transactions for that staff and UTC day window.
- **Tips — PER_STAFF (default):** Tips summed from that staff’s transactions for the day at each branch.
- **Tips — POOLED:** Total tips for all **COMPLETED** transactions at the branch that day divided evenly among distinct `staffProfileId` values that had transactions; each included staff gets a share.
- **Models:** `FLAT_PERCENTAGE` (`commissionRate * base`), `SLIDING_SCALE` (tier brackets on `commissionTiers`), `BASE_PLUS_BONUS` (prorated `baseSalary` by working weekdays in month + `bonusRate * base`), default falls back to flat rate.
- **`triggerOnPaid`:** After payment completion, recalculates affected staff (all staff at branch for POOLED days).

## Scenarios

### Success

- **GIVEN** valid staff and transactions **WHEN** `POST /calculate` **THEN** `200` with earning DTO (`date` as `YYYY-MM-DD` string).
- **GIVEN** existing earning **WHEN** `POST /recalculate` **THEN** `200` with fresh computation.
- **GIVEN** filters **WHEN** `GET /` **THEN** `200` paginated with embedded `staff.user` names.

### Failure

- **GIVEN** invalid/missing JWT **WHEN** protected route **THEN** `401`.
- **GIVEN** customer user **WHEN** `GET /me` **THEN** `403` staff-only (`requireStaff`).
- **GIVEN** non-staff user (no `staffProfile`) **WHEN** `GET /me` **THEN** `403` `"User is not staff"`.
- **GIVEN** unknown `staffProfileId` **WHEN** calculate/recalculate **THEN** `404` `"Staff not found"`.
- **GIVEN** missing `COMMISSION` permission **WHEN** calculate/list/etc. **THEN** `403` insufficient permissions.

## Edge Cases

- `GET /{staffProfileId}` does not verify staff exists; empty list if no earnings.
- Date filters: `dateFrom` start-of-day, `dateTo` end-of-day.
- Working days for `BASE_PLUS_BONUS` exclude Sundays (local date math in service).

## RBAC

| Route | Guard |
|-------|--------|
| `GET /me` | `requireStaff()` (non-customer) |
| `POST /calculate` | `COMMISSION` **create** |
| `POST /recalculate` | `COMMISSION` **update** |
| `GET /`, `GET /{staffProfileId}` | `COMMISSION` **read** |

## Service-Level Test Scenarios (Sprint 7)

### CommissionService.calculateDaily

- **FLAT_PERCENTAGE**: commission = commissionBase * commissionRate; verifies upsert.
- **SLIDING_SCALE**: single tier covers all revenue; multi-tier with bracket boundaries; open-ended tier (`maxRevenue: null`); empty tiers → commission 0.
- **BASE_PLUS_BONUS**: prorated `baseSalary / workingDays` + `bonusRate * base`; month with all Sundays edge; null `baseSalary` and `bonusRate` default to 0.
- **Default (unknown model)**: falls back to flat percentage.
- **Tips PER_STAFF**: sum `tipAmount` on this staff's transactions.
- **Tips POOLED**: total tips divided by distinct staff count at the branch that day; staff with no txs at that branch gets zero.
- Commission base excludes non-service line items (`serviceId` null).
- Discounts subtracted from base per item.
- Multiple transactions on same day: base and tips aggregated.
- Staff not found: throws `"Staff not found"`.
- No transactions: base/tips 0; upserts with zeros (BASE_PLUS_BONUS still gets prorated base salary).

### CommissionService.triggerOnPaid

- Non-POOLED: calculates for the transaction's staff only; returns single earning.
- POOLED: calculates for all distinct staff at the branch that day; returns array.
- Missing `branchId` → returns `null`.
- Non-POOLED with no `staffProfileId` → returns `null`.
- Transaction not found → returns `null`.

### CommissionService.recalculateDay

- Deletes existing `StaffEarning` for staff+day, then recomputes via `calculateDaily`.

### CommissionService.getEarnings / getEarningsForBarber

- Date range filters: `dateFrom` to start-of-day, `dateTo` to end-of-day.
- Pagination: page, limit, totalPages with `total = 0` → `totalPages = 0`.
- Ordering: date desc, staffProfileId asc.
- `getEarningsForBarber` delegates with `staffProfileId` injected.

### getWorkingDaysInMonth (internal)

- Standard month: count weekdays excluding Sundays.
- February edge: leap year vs non-leap.
- Month where 1st is Sunday.

## Dependencies

- **Prisma:** `staffProfile`, `staffEarning`, `transaction`, `branch`, `commissionTier`
- **Transactions:** `CommissionService.triggerOnPaid` from completion pipeline
