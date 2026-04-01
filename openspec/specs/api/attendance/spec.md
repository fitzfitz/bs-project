# API Feature: Attendance (`/api/attendance`)

## Overview

Staff attendance records and shift blocks: list attendance (paginated), clock in/out, list/create/update/delete shift schedules. Combines `ATTENDANCE` RBAC with `orgScopeMiddleware`; clock-in/out handlers also check `userId` where noted.

## API Endpoints

| Method | Path | RBAC | Description |
|--------|------|------|-------------|
| GET | `/` | `ATTENDANCE` **read** | Paginated attendance; query `staffProfileId`, `branchId` (see edge cases), `startDate`, `endDate` (ISO datetime), `page`, `limit`. |
| POST | `/clock-in` | `ATTENDANCE` **create** | Clock in **current user** (JWT `sub`); body includes `branchId` (required by schema; **not persisted** in current service). |
| PATCH | `/{id}/clock-out` | `ATTENDANCE` **update** | Clock out attendance row by id. |
| GET | `/shifts` | Auth only (no feature permission) | List shifts; optional `staffProfileId`, `branchId` (see edge cases), `date`. |
| POST | `/shifts` | `ATTENDANCE` **create** | Upsert shift block by `(staffProfileId, date)`. |
| PATCH | `/shifts/{id}` | `ATTENDANCE` **update** | Update shift block. |
| DELETE | `/shifts/{id}` | `ATTENDANCE` **delete** | Delete shift block. |

## Business Rules

- **Clock in:** Resolves `StaffProfile` by `userId`; rejects if open attendance exists (`clockOut` null); transaction creates `staffAttendance` and sets profile `status` to `AVAILABLE`.
- **Clock out:** Record must exist and `clockOut` must be null; sets `clockOut` and profile `status` to `OFF_DUTY`.
- **List attendance:** Filters by `staffProfileId` and optional clock-in date range; **`branchId` query is not applied in service `where`** (implementation gap).
- **Shifts list:** Filters by `staffProfileId` and `date`; **`branchId` query not applied** in service.
- **Create shift:** `upsert` on unique `(staffProfileId, date)`; updates `startTime`, `endTime`, `note`.

## Scenarios

### Success

- **GIVEN** JWT with `ATTENDANCE` read **WHEN** GET `/` **THEN** **200** + pagination.
- **GIVEN** staff user with profile and no open attendance **WHEN** POST `/clock-in` **THEN** **201**.
- **GIVEN** open attendance row **WHEN** PATCH `/{id}/clock-out` **THEN** **200**.

### Failure

- **GIVEN** no JWT **WHEN** GET `/` **THEN** **401**.
- **GIVEN** JWT without `ATTENDANCE` read **WHEN** GET `/` **THEN** **403**.
- **GIVEN** clock-in but `userId` missing in context **WHEN** POST `/clock-in` **THEN** **401** from handler.
- **GIVEN** user without staff profile **WHEN** `AttendanceService.clockIn` **THEN** throws “Staff profile not found” (handler uncaught → **500**).
- **GIVEN** already clocked in **WHEN** clock in again **THEN** throws “Already clocked in” (→ **500** if uncaught).
- **GIVEN** invalid `clockOut` target **WHEN** clock out **THEN** throws (→ **500** if uncaught).

## Edge Cases

- **Schema vs persistence:** `clockInSchema.branchId` is required for validation but **not** written to `staffAttendance` in `AttendanceService.clockIn`.
- **Query filters ignored:** `branchId` on list attendance and list shifts does not affect Prisma `where` in the current service implementation.
- **Shift `branchId` in schema:** Optional on `createShiftBlockSchema` but not mapped in `createShiftBlock` service fields.

## RBAC

Feature: **`ATTENDANCE`**. Actions: **read** (list), **create** (clock-in, create shift), **update** (clock-out, update shift), **delete** (delete shift). **GET `/shifts`** only requires auth + org scope.

## Dependencies

- **Prisma:** `staffProfile`, `staffAttendance`, `shiftSchedule`.
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
