# Client — Booking

## Overview

End-to-end **customer booking** as a **multi-step wizard**: **service** → **barber** → **time** → **confirm**. State is held in a dedicated Zustand store (`useBookingStore`); server data uses **TanStack Query** and **Axios** via `@/lib/api`. Staff are loaded as “barbers” from `/staff` for UX copy only (generic staff model on the API). Submitting a booking calls `POST /queue` with `source: 'APP'`.

## Business Rules

1. **Services list:** `useServices` fetches `GET /services?limit=100` and caches with `staleTime` 5 minutes; query data is the unwrapped `data` array from the API envelope.
2. **Barbers by branch:** `useBarbers` runs only when `branchId` is truthy; without it the query is disabled and the fetcher returns `[]` if invoked.
3. **Availability:** `useAvailability` requires both `branchId` and `date`; optional `staffProfileId` is appended as a query param when provided. The hook returns the full Axios/API response; UI reads slots from the envelope’s `data`.
4. **Create booking:** `useCreateBooking` posts to `POST /queue` and on success invalidates `['my-bookings']`.
5. **Cancel / reschedule:** `useCancelBooking` and `useRescheduleBooking` invalidate `['my-bookings']` on success; reschedule sends `{ startTime }` in the PATCH body.
6. **Wizard state:** Branch, services, barber (`null` = any), date, and time slot live in `useBookingStore` until confirm resets or completes.

## Components / Widgets (`components/`)

| Component | Purpose |
|-----------|---------|
| `ServiceSelection` | Lists services from `useServices`, grouped by category; toggles selection in the store; “Continue” navigates to `/book/:branchId/barber` when at least one service is selected. |
| `BarberSelection` | Loads staff via `useBarbers(branchId)`; **Any Available** (`null` staff id) or a specific staff member; optional inline `ReviewFeed` per staff; navigates to `/book/:branchId/time`. |
| `TimeSelection` | 14-day date strip; `useAvailability(branchId, date, staffProfileId?)` for slots; local state until Continue writes `setDateTime` and navigates to `/book/:branchId/confirm`. |
| `BookingConfirm` | Summary + `useCreateBooking`; builds ISO `startTime` from date + `HH:mm`; uses `useProfile` for display name fallback; on success `resetBooking` and `navigate('/history')`. Shows incomplete state if store is missing date, time, or services. |

## Hooks (`api/`)

| Hook | Endpoint / behavior |
|------|---------------------|
| `useServices` | `GET /services?limit=100` → `data` array; `staleTime` 5m. |
| `useBarbers` | `GET /staff?branchId=`; disabled without `branchId`. |
| `useAvailability` | `GET /queue/availability?branchId&date&staffProfileId?`; returns full API envelope; UI uses `data?.data` for slots. |
| `useCreateBooking` | `POST /queue`; invalidates `['my-bookings']`. |
| `useCancelBooking` | `POST /queue/:entryId/customer-cancel`; invalidates `['my-bookings']`. |
| `useRescheduleBooking` | `PATCH /queue/:entryId/reschedule` with `{ startTime }`; invalidates `['my-bookings']`. |

## Hook States

### `useServices`

- **Loading**  
  - **GIVEN** the services query is enabled (always)  
  - **WHEN** `isPending` / `isFetching` for the initial load  
  - **THEN** UI shows loading until `data` is the services array.

- **Error**  
  - **GIVEN** `GET /services?limit=100` fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are set for the consumer.

- **Disabled**  
  - **GIVEN** the hook has no `enabled: false` path  
  - **WHEN** the component mounts  
  - **THEN** the query always runs.

- **Success**  
  - **GIVEN** a successful response  
  - **WHEN** data resolves  
  - **THEN** query `data` is the services list (unwrapped from envelope).

### `useBarbers(branchId?)`

- **Loading**  
  - **GIVEN** a truthy `branchId`  
  - **WHEN** the staff request is in flight  
  - **THEN** the query is loading until barbers data returns.

- **Error**  
  - **GIVEN** `GET /staff?branchId=` fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` surface for UI.

- **Disabled**  
  - **GIVEN** `branchId` is falsy  
  - **WHEN** the hook runs  
  - **THEN** `enabled` is false and no network call is made.

- **Success**  
  - **GIVEN** a truthy `branchId` and success response  
  - **WHEN** data resolves  
  - **THEN** `data` is the barbers array.

### `useAvailability(branchId?, date?, staffProfileId?)`

- **Loading**  
  - **GIVEN** `branchId` and `date` are set  
  - **WHEN** availability is fetching  
  - **THEN** UI can show loading for the slot list.

- **Error**  
  - **GIVEN** `GET /queue/availability` fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are available.

- **Disabled**  
  - **GIVEN** `branchId` or `date` is missing  
  - **WHEN** the hook evaluates  
  - **THEN** `enabled` is false.

- **Success**  
  - **GIVEN** a successful response  
  - **WHEN** data resolves  
  - **THEN** the full response object is returned; components use `data?.data` for `TimeSlot[]`.

### `useCreateBooking`

- **Loading**  
  - **GIVEN** `mutate` was called with `CreateBookingInput`  
  - **WHEN** `isPending` is true  
  - **THEN** `POST /queue` is in flight.

- **Error**  
  - **GIVEN** the queue create fails  
  - **WHEN** the mutation errors  
  - **THEN** the mutation `error` is set and `my-bookings` is not invalidated.

- **Disabled**  
  - **GIVEN** the hook does not auto-disable  
  - **WHEN** UI prevents double submit  
  - **THEN** only one in-flight create per user action.

- **Success**  
  - **GIVEN** `POST /queue` succeeds  
  - **WHEN** `onSuccess` runs  
  - **THEN** queries with key `['my-bookings']` are invalidated.

### `useCancelBooking`

- **Loading**  
  - **GIVEN** `mutate(entryId)` was called  
  - **WHEN** `isPending` is true  
  - **THEN** `POST /queue/:entryId/customer-cancel` is in flight.

- **Error**  
  - **GIVEN** cancel fails  
  - **WHEN** the mutation errors  
  - **THEN** error state is on the mutation; history cache unchanged until success invalidation.

- **Disabled**  
  - **GIVEN** no id passed  
  - **WHEN** callers avoid `mutate`  
  - **THEN** no request.

- **Success**  
  - **GIVEN** cancel succeeds  
  - **WHEN** `onSuccess` runs  
  - **THEN** `['my-bookings']` is invalidated.

### `useRescheduleBooking`

- **Loading**  
  - **GIVEN** `mutate({ entryId, startTime })` was called  
  - **WHEN** `isPending` is true  
  - **THEN** `PATCH /queue/:entryId/reschedule` is in flight.

- **Error**  
  - **GIVEN** reschedule fails  
  - **WHEN** the mutation errors  
  - **THEN** mutation error is exposed.

- **Disabled**  
  - **GIVEN** caller responsibility  
  - **WHEN** no mutation invoked  
  - **THEN** no network.

- **Success**  
  - **GIVEN** patch succeeds  
  - **WHEN** `onSuccess` runs  
  - **THEN** `['my-bookings']` is invalidated.

## State (`store.ts`)

- **Fields:** `branchId`, `selectedServiceIds`, `selectedBarberId` (`null` = any), `selectedDate`, `selectedTimeSlot` (`HH:mm`).
- **Actions:** `setBranchInfo`, `toggleService`, `setBarber`, `setDateTime`, `resetBooking`.

## Types (`types.ts`)

- **`ServiceResponse`**, **`BarberResponse`**, **`CreateBookingInput`** — aligned with queue/service API payloads.

## User Interactions

- Pick one or more services → continue to barber step.
- Choose any available or named staff → continue to time step.
- Pick date and available slot → continue to confirm.
- Confirm → POST queue → clear wizard state → history page.

## Scenarios

### Service step

- **GIVEN** services loaded  
- **WHEN** the user toggles services  
- **THEN** totals update and FAB appears; Continue routes to barber step with `branchId` from the URL.

### Barber step

- **GIVEN** staff list loaded  
- **WHEN** the user selects **Any Available**  
- **THEN** `selectedBarberId` is `null` and navigation goes to the time step.

### Time step

- **GIVEN** branch + date  
- **WHEN** availability returns slots  
- **THEN** unavailable slots are disabled; selecting a slot enables Continue.

### Confirm step incomplete

- **GIVEN** missing date, time, or services in the store  
- **WHEN** `BookingConfirm` renders  
- **THEN** user sees “Incomplete Booking” and can restart.

### Confirm success

- **GIVEN** complete selection and successful `POST /queue`  
- **WHEN** the user confirms  
- **THEN** booking store resets and the app navigates to `/history`.

### Cancel / reschedule (hooks)

- **GIVEN** a queue entry id  
- **WHEN** `useCancelBooking` or `useRescheduleBooking` succeeds  
- **THEN** `my-bookings` queries are invalidated.

## Edge Cases

- **`useBarbers` / `useAvailability`:** Queries disabled until `branchId` (and date for availability) are present.
- **`useAvailability` response shape:** Query data is the envelope; components must read `.data` for the slot array.
- **Guest name:** If profile is missing, confirm uses session `user.firstName` or `"Guest"`.
- **Wizard vs URL:** `branchId` in routes should stay in sync with `setBranchInfo` when entering the flow from branch selection (handled outside this folder).

## Dependencies

- `@tanstack/react-query`, `react-router-dom`, `date-fns`, `axios` (`@/lib/api`), `zustand`, `lucide-react`, UI primitives; **reviews** (`ReviewFeed`) embedded on barber step.
