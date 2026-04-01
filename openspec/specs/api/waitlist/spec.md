# API — Customer Self-Service (Prepayment, Cancellation Policies, Waitlist)

## Overview

Extends the booking/queue system with optional **online prepayment**, configurable **cancellation policies** with penalties, and a **waitlist** for fully-booked time slots. All features are controlled by org-level configuration keys and can be independently enabled/disabled.

## New Config Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `PREPAYMENT_ENABLED` | boolean | `false` | Enable/disable online prepayment at booking time |
| `DEPOSIT_PERCENTAGE` | number | `100` | Percentage of total charged at booking (100 = full, 1-99 = deposit) |
| `CANCELLATION_POLICY_HOURS` | number | `0` | Free cancellation window in hours before appointment (0 = always free) |
| `CANCELLATION_PENALTY_PERCENTAGE` | number | `0` | Percentage of prepaid amount forfeited on late cancellation |
| `WAITLIST_ENABLED` | boolean | `false` | Enable/disable waitlist when no slots available |
| `WAITLIST_MAX_PER_SLOT` | number | `5` | Maximum waitlist entries per time slot |

## Database Changes

### QueueEntry — New Fields

| Field | Type | Description |
|-------|------|-------------|
| `prepaidAmount` | Decimal? | Amount prepaid at booking time (null = no prepayment) |
| `prepaymentReference` | String? | Xendit invoice ID for the prepayment |
| `refundAmount` | Decimal? | Amount refunded on cancellation |

### WaitlistEntry — New Model

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Org scope |
| branchId | String | Branch FK |
| userId | String | Customer FK |
| customerName | String | Display name |
| preferredDate | DateTime | Preferred appointment date |
| preferredTimeSlot | String | HH:mm format |
| serviceIds | String[] | Selected service IDs |
| staffProfileId | String? | Preferred staff (optional) |
| status | WaitlistStatus | WAITING, NOTIFIED, CONVERTED, EXPIRED, CANCELLED |
| notifiedAt | DateTime? | When customer was notified of slot availability |
| expiresAt | DateTime | Auto-expiry time (end of preferred time slot) |
| createdAt | DateTime | |

## Endpoints

### Prepayment

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| POST | `/queue/:id/prepay` | JWT | Customer | Create Xendit invoice for booking prepayment |

### Cancellation (Modified)

Existing `POST /queue/:id/customer-cancel` is enhanced:
- When booking has `prepaidAmount > 0`, applies cancellation policy
- Computes refund amount based on `CANCELLATION_POLICY_HOURS` and `CANCELLATION_PENALTY_PERCENTAGE`
- Returns refund details in response

### Waitlist

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| POST | `/queue/waitlist` | JWT | Customer | Join waitlist for a time slot |
| GET | `/queue/waitlist/me` | JWT | Customer | Get user's waitlist entries |
| DELETE | `/queue/waitlist/:id` | JWT | Customer | Leave waitlist |
| GET | `/queue/waitlist` | JWT | QUEUE_MANAGEMENT.read | Admin: view branch waitlist |

### Config (Modified)

Existing config endpoints support the new keys via `CONFIG_DEFAULTS`.

## Business Rules

### Prepayment
1. Only available when `PREPAYMENT_ENABLED` is true
2. Creates a Xendit invoice for the deposit/full amount based on `DEPOSIT_PERCENTAGE`
3. On webhook success: sets `prepaidAmount` and `prepaymentReference` on QueueEntry
4. Booking remains valid even without prepayment (graceful)

### Cancellation Policy
1. When `CANCELLATION_POLICY_HOURS > 0`:
   - Cancellation before the window: full refund
   - Cancellation within the window: penalty applied
2. Penalty = `prepaidAmount * CANCELLATION_PENALTY_PERCENTAGE / 100`
3. Refund = `prepaidAmount - penalty`
4. Non-prepaid bookings cancel freely (no change from current behavior)
5. Audit log records cancellation with penalty details

### Waitlist
1. Only available when `WAITLIST_ENABLED` is true
2. Maximum entries per slot controlled by `WAITLIST_MAX_PER_SLOT`
3. When a booking is cancelled, check for waitlisted customers
4. Notify first waitlisted customer (push + in-app notification)
5. Customer has 15 minutes to convert (status: NOTIFIED -> CONVERTED)
6. Entries auto-expire when the preferred time slot passes
7. Scheduler checks for expired entries every 5 minutes

## RBAC

- Prepayment: Customer only (own bookings)
- Cancellation: Customer only (existing behavior)
- Waitlist join/view/leave: Customer only
- Waitlist admin view: `QUEUE_MANAGEMENT.read`
