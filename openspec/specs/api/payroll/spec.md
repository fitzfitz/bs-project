# Payroll API

## Overview

Builds `PayrollPeriod` rows from aggregated `StaffEarning` over a date range, then drives a state machine: DRAFT → PENDING_APPROVAL → APPROVED | DISPUTED → (DISPUTED → DRAFT via resolve) → DISBURSED. Lists and fetches periods with HQ vs branch vs staff-scoped visibility rules.

**Base path:** `/api/payroll`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer + org + `PAYROLL` read | Paginated list; non-`HQ` users without `staffProfileId` auto-filter to own `staffProfile` (empty if not staff). |
| GET | `/{id}` | Bearer + org + `PAYROLL` read | Period by id; non-HQ non-BRANCH users must own the payroll (`staffProfile.userId`). |
| POST | `/generate` | Bearer + org + `PAYROLL` create | Create **DRAFT** from earnings in range; needs org from earnings or staff profile. |
| POST | `/{id}/submit` | Bearer + org + `PAYROLL` update | DRAFT → PENDING_APPROVAL. |
| POST | `/{id}/approve` | Bearer + org + `PAYROLL` update | PENDING_APPROVAL → APPROVED; sets `approvedBy`/`approvedAt`; audit `APPROVE_PAYROLL`. |
| POST | `/{id}/dispute` | Bearer + org + `PAYROLL` update | Barber disputes **own** period PENDING_APPROVAL → DISPUTED; audit `DISPUTE_PAYROLL`. |
| POST | `/{id}/resolve` | Bearer + org + `PAYROLL` update | DISPUTED → DRAFT. |
| POST | `/{id}/disburse` | Bearer + org + `PAYROLL` update | APPROVED → DISBURSED (RBAC is update, not a separate disburse code). |

## Business Rules

- **Totals:** `totalCommission` and `totalTips` from `staffEarning` in `[periodStart, periodEnd]`; `totalPayout = totalCommission + totalTips`.
- **Transitions:**  
  - DRAFT → PENDING_APPROVAL  
  - PENDING_APPROVAL → APPROVED | DISPUTED  
  - DISPUTED → DRAFT (resolve)  
  - APPROVED → DISBURSED  
  - DISBURSED terminal (no outbound transitions)
- **Dispute:** Handler loads period, asserts `assertBarberOwnsPayroll`, then `dispute`.
- **Generate errors:** Missing staff/org → **400** with message (e.g. `"Staff profile not found"`).

## Scenarios

### Success

- **GIVEN** earnings and staff **WHEN** `POST /generate` **THEN** `201` DRAFT period.
- **GIVEN** DRAFT **WHEN** submit → approve → disburse **THEN** valid sequence and `200` payloads.

### Failure

- **GIVEN** no JWT **THEN** `401`.
- **GIVEN** no `PAYROLL` permission **THEN** `403`.
- **GIVEN** unknown id **WHEN** get/submit/approve/... **THEN** `404`.
- **GIVEN** wrong state **WHEN** transition **THEN** `400` `Invalid transition: ...`.
- **GIVEN** non-owner **WHEN** `POST /{id}/dispute` **THEN** `403` payroll does not belong.
- **GIVEN** staff user **WHEN** `GET /{id}` for another staff’s period (scope not HQ/BRANCH) **THEN** `403`.

## Edge Cases

- List for non-HQ without `staffProfileId`: if user has no `staffProfile`, returns empty list with success.
- `getById` ownership check applies when `scope` is not `HQ` and not `BRANCH` (e.g. staff/barber scope).

## RBAC

All routes wrapped with `PAYROLL` **read**, **create** (generate), or **update** (state changes) per path in `payroll.index.ts`.

## Bulk Operations

### POST `/bulk-approve`

- **Auth:** Bearer + org + `PAYROLL` update
- **Body:** `{ ids: string[] (1..50), note?: string }`
- **Behavior:** All-or-nothing `$transaction`. For each id: load period, validate status is `PENDING_APPROVAL`, transition to `APPROVED`, set `approvedBy`/`approvedAt`, create audit log.
- **Success:** `200 { success: true, data: { approved: number } }`
- **Errors:**
  - `400` — empty ids array, any period not in `PENDING_APPROVAL` state, any period not found
  - `401` — no JWT
  - `403` — no `PAYROLL` update permission

### POST `/bulk-disburse`

- **Auth:** Bearer + org + `PAYROLL` update
- **Body:** `{ ids: string[] (1..50) }`
- **Behavior:** All-or-nothing `$transaction`. For each id: load period, validate status is `APPROVED`, transition to `DISBURSED`, create audit log.
- **Success:** `200 { success: true, data: { disbursed: number } }`
- **Errors:**
  - `400` — empty ids array, any period not in `APPROVED` state, any period not found
  - `401` — no JWT
  - `403` — no `PAYROLL` update permission

### Bulk Scenarios

- **GIVEN** 3 periods in PENDING_APPROVAL **WHEN** `POST /bulk-approve` with their ids **THEN** `200` with `{ approved: 3 }`, all now APPROVED with audit entries.
- **GIVEN** 2 APPROVED + 1 DRAFT **WHEN** `POST /bulk-approve` **THEN** `400` (DRAFT is invalid state), no periods changed (atomic).
- **GIVEN** unknown id in array **WHEN** bulk operation **THEN** `400` "Payroll period not found".
- **GIVEN** empty ids array **WHEN** bulk operation **THEN** `400`.

## Dependencies

- **Prisma:** `payrollPeriod`, `staffEarning`, `staffProfile`, `auditLog`
- **Commissions:** earnings produced by `StaffEarning` / commission pipeline
