# Admin — Attendance

## Overview

Hooks for **attendance records** (clock in/out history) and **shift blocks** (schedule CRUD) scoped by branch and/or staff. Primary UI is **inline on the attendance page** (tables, shift modal, weekly calendar).

## Business rules

1. **BR-1 (Attendance scope):** Attendance history MUST NOT be fetched until the caller supplies at least one of `branchId` or `staffProfileId` (prevents unscoped list queries).
2. **BR-2 (Shifts):** Shift list queries MAY run with any combination of optional filters; empty params are allowed and server defines the result set.
3. **BR-3 (Shift mutations):** After any shift create/update/delete succeeds, all `["shifts"]` queries MUST be invalidated so lists and calendar stay consistent.
4. **BR-4 (API envelope):** List/detail responses use the shared `ApiResponse<T>` shape (`success`, `data`, optional `pagination`).

## Hook consumers (pages / UI)

| Consumer | Hooks used | Role |
|----------|------------|------|
| `apps/admin/src/pages/attendance/page.tsx` | `useAttendance`, `useShifts`, `useCreateShift`, `useDeleteShift` | Attendance log tab (loading text, pagination), shifts tab (loading, delete, create modal with `isPending`), calendar (`useShifts` per day — note multiple queries in `WeeklyCalendar`). |
| Same page (indirect) | `useBarbers` (barbers feature) | Barber dropdown for shift creation — not part of attendance hooks but coupled in UI. |

There is **no** dedicated `widgets/` folder under `features/attendance`; behavior is page-local.

## Hooks (`api/use-attendance.ts`)

| Hook | Method / path | Query key | `enabled` |
|------|---------------|-----------|-----------|
| `useAttendance(params)` | `GET /attendance?...` | `["attendance", params]` | when `branchId` or `staffProfileId` is set |
| `useShifts(params)` | `GET /attendance/shifts?...` | `["shifts", params]` | always `true` |
| `useCreateShift` | `POST /attendance/shifts` | — | mutation |
| `useUpdateShift` | `PATCH /attendance/shifts/:id` | — | mutation |
| `useDeleteShift` | `DELETE /attendance/shifts/:id` | — | mutation |

### Request / response shapes

**Query params (`useAttendance`):** `branchId?`, `staffProfileId?`, `startDate?`, `endDate?`, `page?` → serialized as query string.

**Response (`useAttendance`):** `ApiResponse<AttendanceRecord[]>`; optional `pagination` when server paginates (page consumes `attPagination`).

**`AttendanceRecord`:** `id`, `clockIn`, `clockOut` (nullable), `branchId`, `notes`, optional nested `staff`, `branch`.

**Query params (`useShifts`):** `branchId?`, `staffProfileId?`, `date?`.

**Response (`useShifts`):** `ApiResponse<ShiftBlock[]>`.

**`ShiftBlock`:** `id`, `staffProfileId`, `branchId` (nullable), `date`, `startTime`, `endTime`, `notes`, optional `staff`.

**`useCreateShift` body:** `{ staffProfileId, branchId?, date, startTime, endTime, notes? }` → `ApiResponse<ShiftBlock>`.

**`useUpdateShift` variables:** `{ id, staffProfileId?, branchId?, date?, startTime?, endTime?, notes? }` → `ApiResponse<ShiftBlock>`.

**`useDeleteShift`:** `id: string` → `ApiResponse<unknown>`.

## Hook states (queries)

### `useAttendance`

- **Loading:** GIVEN query `enabled` is true WHEN the fetch is in progress THEN the hook exposes `isLoading: true` (and typically `isFetching: true`) and `data` is undefined until settled.
- **Error:** GIVEN the API returns an error WHEN the query settles THEN the hook exposes `isError: true` and `error` is set (message depends on `api` / Axios wrapper).
- **Disabled:** GIVEN neither `branchId` nor `staffProfileId` is set WHEN the hook initializes THEN `enabled` is false, no request is made, and `isLoading` is false with no fetch.
- **Success:** GIVEN a successful response WHEN the hook settles THEN `data` matches `ApiResponse<AttendanceRecord[]>` and optional `pagination`.

### `useShifts`

- **Loading:** GIVEN the query is mounted WHEN a fetch is in progress THEN `isLoading: true` / `isFetching` as appropriate and `data` undefined until first success.
- **Error:** GIVEN the API errors WHEN the query settles THEN `isError: true` and `error` is populated.
- **Disabled:** GIVEN this hook has **no** `enabled: false` guard — “disabled” in product terms means **UI may still show empty branch**; the request still runs with whatever params were passed (including empty). Document as **N/A for query disable**; calendar/shift tabs pass `branchId` from store.
- **Success:** GIVEN success WHEN settled THEN `data.data` is `ShiftBlock[]`.

## Hook states (mutations)

### `useCreateShift` / `useUpdateShift` / `useDeleteShift`

- **Loading / pending:** GIVEN `mutate` or `mutateAsync` was called WHEN the mutation is in flight THEN `isPending: true` (TanStack Query v5).
- **Error:** GIVEN the API returns an error WHEN the mutation settles THEN `isError: true` and `error` is set.
- **Disabled (caller-side):** GIVEN required UI inputs are missing (e.g. no `staffProfileId` on attendance page) WHEN the user attempts submit THEN the page disables the button; the hook itself does not auto-disable.
- **Success:** GIVEN success WHEN settled THEN `onSuccess` invalidates `["shifts"]`; response body matches `ApiResponse<ShiftBlock>` (create/update) or delete envelope.

## UI / widget GWT (attendance page)

### Attendance log tab

- **GIVEN** a branch is selected in global store **WHEN** the attendance tab is active **THEN** `useAttendance` runs and the page shows “Loading...” while `loadingAttendance` is true, else renders the table or empty state.
- **GIVEN** `useAttendance` fails **WHEN** the page reads `isError` **THEN** the current implementation should surface error (if extended); today the page primarily branches on `isLoading` — spec expectation for parity: show error banner when `isError`.
- **GIVEN** no branch/staff scope **WHEN** only empty `branchId` is passed **THEN** attendance query is disabled and the table shows no fetch (empty/undefined data until scope fixed).

### Shifts tab

- **GIVEN** branch and date **WHEN** shifts load **THEN** loading text shows until data arrives; delete uses `useDeleteShift` with confirm.
- **GIVEN** create modal open **WHEN** user submits **THEN** submit button uses `createShift.isPending` to disable and show “Creating...”.

### Calendar tab

- **GIVEN** a week range **WHEN** `WeeklyCalendar` mounts **THEN** seven `useShifts` queries run (one per day); loading/error behavior is per-query (no aggregate loading UI in current code).

## Scenarios

### Attendance list with branch

- **GIVEN** `branchId` in params  
- **WHEN** `useAttendance` runs  
- **THEN** `GET /attendance` is called.

### Attendance disabled

- **GIVEN** neither `branchId` nor `staffProfileId`  
- **WHEN** `useAttendance` is used  
- **THEN** query is disabled.

### Shift create invalidates

- **GIVEN** successful create  
- **WHEN** mutation completes  
- **THEN** `shifts` queries invalidate.

## Edge cases

- `useAttendance` will not fetch with empty filters — callers must supply scope.
- `useShifts` has no `enabled` guard — may run with empty params (server behavior defines result).
- Weekly calendar uses hooks in a loop — violates Rules of Hooks lint locally with eslint-disable; behavior is intentional for prototype.

## State

- React Query: `["attendance", params]`, `["shifts", params]`; mutations invalidate `["shifts"]`.

## RBAC

- **`ATTENDANCE`**.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
