# Queue & Booking API

## Overview

Manages queue entries linked to bookings: list and inspect the queue, create bookings/walk-ins, update operational status, assign staff, postpone estimates, cancel (staff or customer), reschedule customer bookings, expose availability slots, and let authenticated customers list their own entries. Real-time updates are pushed to branch channels via Pusher, and push notifications are sent to customers via OneSignal on key lifecycle events.

**Base path:** `/api/queue` (see `apps/api/src/index.ts`).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/availability` | Public | Available 30-minute slots for a branch and date; optional `staffProfileId`. |
| GET | `/` | Bearer + org scope | List queue entries; query: `branchId` (required), optional `date` (YYYY-MM-DD), `staffProfileId`, `status`. |
| GET | `/{id}` | Bearer + org scope | Queue entry by ID with relations. |
| POST | `/` | Bearer + org scope | Create booking or walk-in; customers forced to `customerId = caller` and `source = APP`. |
| GET | `/me` | Bearer + org scope | Current user’s queue entries (requires `userId` in JWT). |
| PATCH | `/{id}/status` | Bearer + org + `QUEUE_MANAGEMENT` update | Update queue status; at `AT_CHECKOUT` may auto-create a draft transaction (best-effort). |
| POST | `/{id}/assign` | Bearer + org + `QUEUE_MANAGEMENT` update | Assign `staffProfileId`. |
| POST | `/{id}/postpone` | Bearer + org + `QUEUE_MANAGEMENT` update | Increase `estimatedWait` by `minutes` (default 10). |
| POST | `/{id}/cancel` | Bearer + org + `QUEUE_MANAGEMENT` delete | Staff cancel → status `CANCELLED`. |
| POST | `/{id}/customer-cancel` | Bearer + org scope | Customer cancels own entry if status `WAITING` or `CALLED`. |
| POST | `/{id}/prepay` | Bearer + customer | Create Xendit invoice for deposit when `PREPAYMENT_ENABLED` is `true`; stores `prepaymentReference`. |
| PATCH | `/{id}/reschedule` | Bearer + org scope | Customer reschedules own booking (not walk-in without booking); slot conflict check if staff assigned. |

## Request / response shapes (selected endpoints)

### GET `/` — list

**Query:** `branchId` (required), optional `date` (`YYYY-MM-DD`), `staffProfileId`, `status` (`WAITING` | `CALLED` | `IN_SERVICE` | `COMPLETED` | `NO_SHOW` | `CANCELLED` | `AT_CHECKOUT` | `PAID`).

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "branchId": "string",
      "customerId": "string",
      "customerName": "string | null",
      "status": "string",
      "position": 0,
      "staffProfileId": "string | null",
      "bookingId": "string | null",
      "estimatedWait": 0,
      "staff": {
        "id": "string",
        "user": { "firstName": "string", "lastName": "string" }
      },
      "booking": {
        "id": "string",
        "scheduledAt": "string (ISO)",
        "note": "string | null",
        "totalDuration": 0,
        "items": [
          {
            "service": {
              "name": "string",
              "durationMinutes": 0,
              "basePrice": 0
            }
          }
        ]
      }
    }
  ]
}
```

### POST `/` — create

**Request** (`application/json`):

```json
{
  "customerId": "string (optional; walk-in guest if omitted)",
  "customerName": "string",
  "customerPhone": "string (optional)",
  "branchId": "string",
  "staffProfileId": "string (optional)",
  "serviceIds": ["string"],
  "startTime": "string (ISO 8601 datetime)",
  "estimatedDuration": 0,
  "source": "APP | WEB | WALK_IN",
  "notes": "string (optional)"
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "organizationId": "string",
    "branchId": "string",
    "customerId": "string",
    "customerName": "string | null",
    "status": "WAITING",
    "source": "APP | WEB | WALK_IN",
    "position": 0,
    "staffProfileId": "string | null",
    "bookingId": "string",
    "estimatedWait": 0
  }
}
```

(Shape matches persisted `queueEntry` row returned from service; relations may be loaded elsewhere when re-fetching.)

### PATCH `/{id}/status` — status update

**Request** (`application/json`):

```json
{
  "status": "WAITING | CALLED | IN_SERVICE | COMPLETED | NO_SHOW | CANCELLED | AT_CHECKOUT | PAID"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "string",
    "calledAt": "string | null",
    "startedAt": "string | null",
    "completedAt": "string | null"
  }
}
```

### GET `/availability`

**Query:** `branchId` (required), `date` (`YYYY-MM-DD`, required), `staffProfileId` (optional).

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": [
    {
      "time": "string (slot label)",
      "available": true
    }
  ]
}
```

## Business Rules

1. **Emergency closure:** If `branch.isEmergencyClosed`, creating an entry returns **403**; availability returns an empty slot list.
2. **Pricing & duration:** Services resolved with branch overrides, tier surcharges, surge rules (WIB day/hour from `startTime`), combo vs non-combo duration rules.
3. **Staff double-booking:** If `staffProfileId` is set, overlapping bookings (strict overlap) on that staff return **409** `"Time slot already booked"`.
4. **Walk-in guest:** Missing `customerId` creates a guest `User` with default customer `TenantRole`; fails with **500** if no default customer role exists.
5. **Customer cancel / reschedule:** Entry must belong to caller (`customerId === userId`); only `WAITING` or `CALLED`; reschedule requires a linked `booking` (walk-ins without booking cannot reschedule); conflicts → **409**.
6. **Prepay:** Caller must be customer; entry `WAITING` with a booking and line items; `PREPAYMENT_ENABLED` must be `true`; amount = `sum(booking.items.price) * (DEPOSIT_PERCENTAGE / 100)` rounded; Xendit `secret` required in env.
7. **Customer cancel with prepaid:** If `prepaidAmount > 0`, compute hours until `booking.scheduledAt`; if hours > `CANCELLATION_POLICY_HOURS`, `refundAmount = prepaidAmount`; else `refundAmount = prepaidAmount * (1 - CANCELLATION_PENALTY_PERCENTAGE/100)`; persist `refundAmount` and audit details. After cancel, notify next waitlisted customer for the same slot (best-effort).
6. **Availability:** Respects holidays (`branchHoliday`), operating hours, emergency closure; marks half-hour slots busy from existing entries’ `booking.scheduledAt` or `createdAt`.

## Scenarios

### Success

- **GIVEN** a valid `branchId` and optional filters **WHEN** `GET /` **THEN** `200` and `success: true` with ordered entries (`position` ascending).
- **GIVEN** an existing queue id **WHEN** `GET /{id}` **THEN** `200` with full entry payload.
- **GIVEN** valid booking payload and open branch **WHEN** `POST /` **THEN** `201` with created entry (and booking).
- **GIVEN** authenticated user **WHEN** `GET /me` **THEN** `200` with entries for `customerId = sub`.
- **GIVEN** staff with `QUEUE_MANAGEMENT` update **WHEN** `PATCH /{id}/status` with allowed status **THEN** `200` with updated entry.
- **GIVEN** public client **WHEN** `GET /availability` with valid `branchId` & `date` **THEN** `200` with `{ time, available }[]`.

### Failure

- **GIVEN** no `Authorization` on a protected route **WHEN** request **THEN** `401` Unauthorized.
- **GIVEN** JWT without `QUEUE_MANAGEMENT` update **WHEN** `PATCH /{id}/status` **THEN** `403` Forbidden (RBAC).
- **GIVEN** unknown id **WHEN** `GET /{id}` **THEN** `404` `"Queue entry not found"`.
- **GIVEN** customer A’s entry **WHEN** customer B calls `customer-cancel` or `reschedule` **THEN** `403`.
- **GIVEN** entry not in `WAITING`/`CALLED` **WHEN** customer cancel/reschedule **THEN** `400`.
- **GIVEN** closed branch **WHEN** `POST /` **THEN** `403` emergency message.
- **GIVEN** staff double-booking (overlapping slot for same `staffProfileId`) **WHEN** `POST /` **THEN** `409` with message `Time slot already booked`.

### HTTP status coverage (`POST /`)

| Code | Applies |
|------|---------|
| **200** | N/A — create returns **201**. |
| **201** | Booking/queue entry created. |
| **400** | Validation / invalid body (OpenAPI/Zod). |
| **401** | Missing/invalid JWT. |
| **403** | Emergency-closed branch; org scope missing; wrong customer on cancel/reschedule. |
| **404** | N/A for create (no id in URL). |
| **409** | Staff time-slot overlap (`Time slot already booked`). |
| **500** | No default customer role for walk-in guest path; uncaught errors. |

### HTTP status coverage (`PATCH /{id}/status`)

| Code | Applies |
|------|---------|
| **200** | Status updated. |
| **400** | N/A — invalid status may surface as handler/service error (**500**) if uncaught. |
| **401** | Missing JWT. |
| **403** | Missing `QUEUE_MANAGEMENT` update. |
| **404** | N/A — Prisma update missing id may surface **500**. |
| **409** | N/A |

### HTTP status coverage (`GET /availability`)

| Code | Applies |
|------|---------|
| **200** | Slot list (may be empty if closed/holiday). |
| **400** | Invalid query (OpenAPI/Zod) when applicable. |
| **401** | N/A — public route. |
| **403** | N/A |
| **404** | N/A |
| **409** | N/A |

## Push Notifications (OneSignal)

Push notifications are sent to customers via `NotificationService.sendPush()` at the following lifecycle points. A corresponding `Notification` database record is also created for each push so the in-app notification inbox works even if push delivery fails. All notifications are best-effort (failures are logged, never block the request).

| Trigger | Recipient | Title | Body | Data |
|---------|-----------|-------|------|------|
| `POST /` success (booking created) | `customerId` | Booking Confirmed | "Your booking at {branchName} is confirmed!" | `{ type: "BOOKING_CONFIRMED", bookingId, branchId }` |
| `PATCH /{id}/status` → `CALLED` | `customerId` | Your Turn Is Coming | "You've been called — please head to {branchName}!" | `{ type: "QUEUE_CALLED", queueEntryId, branchId }` |
| `PATCH /{id}/status` → `COMPLETED` | `customerId` | Service Complete | "Your service is complete. Thank you for visiting!" | `{ type: "QUEUE_COMPLETED", queueEntryId, branchId }` |
| Scheduler (every 5 min) | `customerId` | Appointment Reminder | "Your appointment at {branchName} is in 30 minutes!" | `{ type: "APPOINTMENT_REMINDER", bookingId, branchId }` |

**Appointment reminder cron:** Runs every 5 minutes. Finds bookings with `scheduledAt` between now+25min and now+30min, status `WAITING`, and sends a push to the linked `customerId`. Deduplication: only sends if no `Notification` with `type: "APPOINTMENT_REMINDER"` and matching `bookingId` exists for that user.

**Walk-in entries:** Walk-in guests (auto-created `User`) will receive push notifications only if they have registered their device with OneSignal using the generated `userId` as `external_id`. In practice, walk-ins from the admin POS will not receive pushes.

## Edge Cases

- `listQueue` with `date` filters `createdAt` to that local calendar day (start of day → next day).
- `postponeEntry` uses `findUnique` then `update`; if id missing, service throws `Error` (may surface as **500** if uncaught).
- Auto draft transaction on `AT_CHECKOUT` swallows errors (logged only).
- Org/branch scoping applied via `orgScopeMiddleware` on `db` after auth.

## RBAC

| Endpoint group | Permission |
|----------------|------------|
| `GET /`, `GET /{id}`, `POST /`, `GET /me`, customer cancel/reschedule | Authenticated + org scope (no feature code on these routes). |
| `PATCH /{id}/status`, `POST /{id}/assign`, `POST /{id}/postpone` | `QUEUE_MANAGEMENT` **update** |
| `POST /{id}/cancel` | `QUEUE_MANAGEMENT` **delete** |
| `GET /availability` | None |

## Service-Level Test Scenarios (Sprint 7)

### QueueService.createEntry

- Happy path: booking + queue entry created; position = count(today) + 1.
- Emergency-closed branch: throws 403.
- Staff double-booking (overlapping interval): throws 409 `"Time slot already booked"`.
- Walk-in guest: no `customerId` → guest `User` created with default CUSTOMER role; `NotificationPreference` created with `emailOptOut: false`; 500 if no default role.
- Surge pricing applied based on WIB day/hour from `startTime`.
- Tier surcharges applied when `staffProfileId` with tier is selected.
- Combo vs non-combo duration calculation.
- Pusher event `QUEUE_UPDATED` fired after creation.
- Push notification for booking confirmed (best-effort).

### QueueService.updateStatus

- `CALLED` sets `calledAt`; push notification sent.
- `IN_SERVICE` sets `startedAt`; no push.
- `COMPLETED` sets `completedAt`; push notification sent.
- `AT_CHECKOUT` creates draft transaction (best-effort; failure logged, not thrown).
- Arbitrary status accepted (no state machine enforcement in code).
- Pusher event on every status change.

### QueueService.assignStaff

- Updates `staffProfileId` on the entry.
- Pusher event.
- No overlap conflict check (unlike `createEntry`).

### QueueService.postponeEntry

- Adds `minutes` to existing `estimatedWait`.
- Entry not found: throws `Error("Entry not found")`.
- Negative minutes not rejected.

### QueueService.cancelEntry (staff)

- Sets status `CANCELLED`.
- Does NOT cancel linked booking (unlike customer cancel).
- Pusher event.

### QueueService.customerCancelEntry

- 404 if entry not found.
- 403 if `customerId !== userId`.
- 400 if status not `WAITING` or `CALLED`.
- Success: queue `CANCELLED`; linked booking `CANCELLED` with `cancelledAt`.

### QueueService.rescheduleEntry

- 404 / 403 / 400 ownership and status checks (same as cancel).
- 400 if no linked booking (walk-in).
- 409 if staff-assigned and new slot overlaps existing entries.
- Success: booking `scheduledAt` updated; queue status reset to `WAITING`.

### QueueService.getAvailableSlots

- Emergency-closed branch → empty array.
- Holiday `isClosed` → empty array.
- Operating hours respected; slots generated in 30-min increments.
- Existing entries mark their slot as busy.
- Staff filter narrows which entries are considered busy.

### QueueService.listQueue

- Date filter constrains `createdAt` to local calendar day.
- Status and staff filters applied.
- Ordered by `position` ascending.

### QueueService.getUserEntries

- Returns entries where `customerId = userId`, ordered by `createdAt` desc.

## Dependencies

- **Prisma:** `queueEntry`, `booking`, `branch`, `service`, `staffProfile`, `tenantRole`, `user`, `operatingHour`, `branchHoliday`, `surgeRule`, etc.
- **Transactions:** `TransactionService.createTransaction` when status → `AT_CHECKOUT`.
- **Pusher:** optional via `getPusher`; triggers `QUEUE_UPDATED` on branch channel.
- **Notifications:** optional `NotificationService` via `createNotificationService(env)` for OneSignal push. Also creates `Notification` DB records for in-app inbox.
- **Scheduler:** appointment reminder cron (every 5 min) for upcoming bookings.
