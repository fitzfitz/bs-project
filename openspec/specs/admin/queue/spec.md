# Feature: Admin Queue Management

## Overview

The queue feature provides API hooks for managing the real-time customer queue system in the barbershop. It allows listing queue entries by branch (with optional filters), updating entry statuses with optimistic updates, assigning staff to entries, postponing entries, cancelling entries, and creating new walk-in entries. The feature auto-refreshes every 30 seconds and is consumed by the queue page and the barber dashboard.

## Hooks

| Hook | Method | Endpoint | Query Key | Notes |
|------|--------|----------|-----------|-------|
| `useQueue(params)` | GET | `/queue?branchId=&date=&status=&staffProfileId=` | `["queue", params]` | Refetches every 30s, disabled without `branchId` |
| `useUpdateQueueStatus()` | PATCH | `/queue/:id/status` | Mutation, optimistic updates + invalidates `["queue"]` | |
| `useAssignStaff()` | POST | `/queue/:id/assign` | Mutation, invalidates `["queue"]` | |
| `usePostponeEntry()` | POST | `/queue/:id/postpone` | Mutation, invalidates `["queue"]` | Default 10 minutes |
| `useCancelEntry()` | POST | `/queue/:id/cancel` | Mutation, invalidates `["queue"]` | |
| `useCreateEntry()` | POST | `/queue` | Mutation, invalidates `["queue"]` | Walk-in creation |

## Types

### QueueEntry
```
{
  id: string
  status: "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "AT_CHECKOUT" | "PAID"
  source: "APP" | "WEB" | "WALK_IN"
  position: number
  scheduledFor: string | null
  startTime: string | null
  endTime: string | null
  estimatedDuration: number
  estimatedWait: number | null
  customerName: string | null
  customerPhone?: string | null
  notes: string | null
  calledAt: string | null
  startedAt: string | null
  completedAt: string | null
  customer?: { firstName, lastName, phone? } | null
  staffProfile?: { id, user: { firstName, lastName } } | null
  services?: { service: { name, durationMinutes, basePrice } }[]
  booking?: { id, scheduledAt, note?, items?: { service: { name, basePrice } }[] } | null
  createdAt: string
}
```

### CreateEntryInput
```
{
  branchId: string
  customerName: string
  customerPhone?: string
  staffProfileId?: string
  serviceIds: string[]
  startTime: string
  estimatedDuration: number
  source?: "APP" | "WEB" | "WALK_IN"
  notes?: string
}
```

## Business Rules

1. `useQueue` is disabled when `branchId` is empty — returns no data.
2. Queue list auto-refreshes every 30 seconds via `refetchInterval: 30_000`.
3. `useUpdateQueueStatus` implements optimistic updates:
   - Cancels pending queue queries
   - Snapshots all `["queue"]` query data
   - Immediately updates the entry's status in all cached queries
   - On error, rolls back all cached queries to snapshots
   - On settle (success or error), invalidates all `["queue"]` queries
4. `usePostponeEntry` defaults to 10 minutes if no `minutes` parameter is provided.
5. All mutation hooks invalidate the `["queue"]` query family on success to ensure fresh data.
6. Queue entries have 8 possible statuses representing the full lifecycle: WAITING → CALLED → IN_SERVICE → COMPLETED/AT_CHECKOUT → PAID (or NO_SHOW/CANCELLED at any point).
7. Entries can originate from 3 sources: APP (mobile booking), WEB (web booking), WALK_IN (in-person).

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/queue/page.tsx` | `useQueue`, `useUpdateQueueStatus`, `useAssignStaff`, `usePostponeEntry`, `useCancelEntry`, `useCreateEntry`. |
| `pages/pos/page.tsx` | `useQueue` (today’s entries for context / linking to checkout). |
| `features/dashboard/widgets/barber-dashboard.tsx` | `useQueue` with `staffProfileId` + today. |
| `pages/barber-portal/my-schedule.tsx` | `useQueue` for staff schedule view. |

## Hook States

### Query hooks (`useQueue`)

- **Loading:** GIVEN truthy `branchId` WHEN `GET /queue` is fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN query settles THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN falsy `params.branchId` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `data` is `QueueEntry[]` envelope; list **refetches every 30s** while subscribed (`refetchInterval: 30_000`).

### Mutation hooks (`useUpdateQueueStatus`)

- **Pending:** GIVEN `mutate` called WHEN PATCH in flight THEN `isPending: true`.
- **Error:** GIVEN PATCH fails WHEN mutation errors THEN optimistic state **rolls back** from snapshot, then `onSettled` invalidates `["queue"]`.
- **Success:** GIVEN PATCH succeeds WHEN mutation completes THEN `onSettled` invalidates all **`["queue"]`** queries (after optimistic UI).

### Mutation hooks (`useAssignStaff`, `usePostponeEntry`, `useCancelEntry`, `useCreateEntry`)

- **Pending:** GIVEN mutation invoked WHEN request in flight THEN `isPending: true`.
- **Error:** GIVEN API rejects WHEN mutation fails THEN `isError: true`, `error` available to UI.
- **Success:** GIVEN success WHEN mutation resolves THEN **`["queue"]`** queries invalidate (fresh list).

## Scenarios

### Scenario: List queue entries for a branch

- **GIVEN** a branch is selected
- **WHEN** `useQueue({ branchId: "b1" })` is called
- **THEN** returns queue entries from `GET /queue?branchId=b1`
- **AND** auto-refreshes every 30 seconds

### Scenario: List with filters

- **GIVEN** a branch is selected with additional filters
- **WHEN** `useQueue({ branchId: "b1", date: "2024-06-01", status: "WAITING" })` is called
- **THEN** query params include `branchId`, `date`, and `status`

### Scenario: No branch selected

- **GIVEN** `branchId` is empty
- **WHEN** `useQueue({ branchId: "" })` is called
- **THEN** the query is disabled and no API call is made

### Scenario: Update status with optimistic update

- **GIVEN** a queue entry with status "WAITING"
- **WHEN** `updateQueueStatus.mutate({ id: "q1", status: "CALLED" })` is called
- **THEN** the entry's status is immediately updated to "CALLED" in all cached queries
- **AND** `PATCH /queue/q1/status` is called

### Scenario: Optimistic update rollback on error

- **GIVEN** an optimistic status update was applied
- **WHEN** the PATCH API call returns an error
- **THEN** all cached queries are rolled back to their snapshot state
- **AND** queries are invalidated on settle

### Scenario: Assign staff to entry

- **GIVEN** a queue entry exists
- **WHEN** `assignStaff.mutate({ id: "q1", staffProfileId: "sp1" })` is called
- **THEN** `POST /queue/q1/assign` is called with `{ staffProfileId: "sp1" }`
- **AND** queue queries are invalidated on success

### Scenario: Postpone entry

- **GIVEN** a queue entry exists
- **WHEN** `postponeEntry.mutate({ id: "q1" })` is called without minutes
- **THEN** `POST /queue/q1/postpone` is called with `{ minutes: 10 }` (default)

### Scenario: Postpone with custom duration

- **GIVEN** a queue entry exists
- **WHEN** `postponeEntry.mutate({ id: "q1", minutes: 15 })` is called
- **THEN** `POST /queue/q1/postpone` is called with `{ minutes: 15 }`

### Scenario: Cancel entry

- **GIVEN** a queue entry exists
- **WHEN** `cancelEntry.mutate("q1")` is called
- **THEN** `POST /queue/q1/cancel` is called
- **AND** queue queries are invalidated on success

### Scenario: Create walk-in entry

- **GIVEN** branch is selected and customer details are available
- **WHEN** `createEntry.mutate({ branchId, customerName, serviceIds, ... })` is called
- **THEN** `POST /queue` is called with the entry data
- **AND** queue queries are invalidated on success

## Edge Cases

- Multiple cached query keys (different branch/date/status combinations) all updated during optimistic update
- Rapid successive status updates → each cancels previous pending queries and creates new snapshots
- Staff profile filter returns empty array for barber with no queue entries
- Entry with both `services` array and `booking.items` → consumers handle both paths
- Walk-in entry without `customerPhone` → field is optional

## RBAC

- Queue management is gated at the page/route level
- Individual hooks do not perform permission checks

## Dependencies

- `@tanstack/react-query` — query/mutation management with optimistic updates
- `@/lib/api` — Axios client with auth interceptors
