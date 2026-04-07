# TMNG Feature Catalog

> Complete inventory of every feature across the API, admin dashboard, and client PWA. Each section lists endpoints, UI pages, business rules, and dependencies.
>
> For detailed business logic calculations (pricing formulas, commission models, state machines), see [business_logic.md](business_logic.md).
> For industry-specific examples and seed data, see the [templates directory](templates/) — e.g., [barbershop template](templates/barbershop.md).

---

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
2. [Branches & Settings](#2-branches--settings)
3. [Staff Management](#3-staff-management)
4. [Queue & Scheduling](#4-queue--scheduling)
5. [Waitlist](#5-waitlist)
6. [Point of Sale (POS) & Transactions](#6-point-of-sale-pos--transactions)
7. [Payments](#7-payments)
8. [Commission & Payroll](#8-commission--payroll)
9. [Inventory](#9-inventory)
10. [Cash Drawer](#10-cash-drawer)
11. [Services & Catalog](#11-services--catalog)
12. [Loyalty & Referrals](#12-loyalty--referrals)
13. [Reviews](#13-reviews)
14. [CRM & Customer Insights](#14-crm--customer-insights)
15. [Campaigns & Promotions](#15-campaigns--promotions)
16. [Retention](#16-retention)
17. [Notifications](#17-notifications)
18. [Analytics & Dashboards](#18-analytics--dashboards)
19. [Reports](#19-reports)
20. [Financial Oversight](#20-financial-oversight)
21. [Audit & Anomaly Detection](#21-audit--anomaly-detection)
22. [User & Role Management](#22-user--role-management)
23. [Organization Config](#23-organization-config)
24. [Platform Admin](#24-platform-admin)
25. [Media Upload](#25-media-upload)
26. [Health & Monitoring](#26-health--monitoring)
27. [i18n (Internationalization)](#27-i18n-internationalization)

---

## 1. Authentication & Users

**API module:** `features/auth/`
**OpenSpec:** `api/auth`, `admin/auth`, `client/auth`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create customer account |
| POST | `/auth/login` | Public | Email/password login (requires `orgSlug`) |
| POST | `/auth/google` | Public | Google OAuth (customers only, JWKS verified) |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/forgot-password` | Public | Password reset request (stub — no email sent) |
| GET | `/auth/me` | Auth | Get current user profile + permissions + org currency |
| PATCH | `/auth/me` | Auth | Update profile (name, phone, email) |
| DELETE | `/auth/me` | Auth | Delete account (anonymize, deactivate, cleanup) |
| GET | `/auth/users/search` | Auth | Search users by email/name (for admin user picker) |

### Admin UI
- **Login page** (`/login`) — email/password + orgSlug
- **Logout page** (`/logout`)

### Client UI
- **Login page** (`/login`) — email/password + Google OAuth
- **Register page** (`/register`)
- **Forgot password page** (`/forgot-password`)
- **Profile page** (`/profile`) — view/edit profile, delete account
- **Edit profile page** (`/profile/edit`)

### Key Business Rules
- JWT access + refresh token rotation
- Google OAuth for customers only (staff always email/password)
- Users belong to exactly one organization
- Login requires `orgSlug` to identify the tenant
- Session includes full permission matrix + org currency/locale
- Rate limited: login 5/min, register 3/min, refresh 10/min

### Known Gaps
- **GAP-37**: Forgot password is a stub — no actual email sent

---

## 2. Branches & Settings

**API module:** `features/branches/`
**OpenSpec:** `api/branches`, `admin/branches`, `client/branches`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/branches` | Public | List branches (with operating hours, ratings) |
| GET | `/branches/:id` | Public | Branch detail |
| POST | `/branches` | RBAC | Create branch |
| PATCH | `/branches/:id` | RBAC | Update branch settings |
| GET | `/branches/:id/hours` | Public | Operating hours for a branch |
| PUT | `/branches/:id/hours` | RBAC | Set operating hours |
| GET | `/branches/:id/surge-rules` | RBAC | List surge pricing rules |
| POST | `/branches/:id/surge-rules` | RBAC | Create surge rule |
| DELETE | `/branches/:id/surge-rules/:ruleId` | RBAC | Delete surge rule |
| POST | `/branches/:id/emergency-close` | RBAC | Emergency closure (cancels bookings, notifies) |
| POST | `/branches/:id/reopen` | RBAC | Reopen after emergency |
| GET | `/branches/:id/holidays` | Public | List holidays |
| POST | `/branches/:id/holidays` | RBAC | Add holiday |
| DELETE | `/branches/:id/holidays/:holidayId` | RBAC | Remove holiday |

### Admin UI
- **Branch settings page** (`/branches`) — tabs: Details (name, address, tip distribution, image upload), Operating Hours, Surge Pricing, Holidays

### Client UI
- **Branch discovery** (`/book`) — list + map view (Leaflet), search by city
- **Branch detail** — in booking flow, shows services/hours/rating

### Key Business Rules
- Operating hours per day-of-week with open/close time
- Emergency closure cancels all active queue entries and today's bookings
- Holidays override operating hours (closed or custom hours)
- Surge pricing rules match by day-of-week + hour range, apply multiplier to service prices
- Branch image uploaded via MinIO

---

## 3. Staff Management

**API module:** `features/staff/`
**OpenSpec:** `api/staff`, `admin/barbers`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/staff` | RBAC | List staff profiles |
| GET | `/staff/:id` | RBAC | Staff detail |
| POST | `/staff` | RBAC | Create staff profile (links to user) |
| PATCH | `/staff/:id` | RBAC | Update staff (tier, status, commission model) |
| POST | `/staff/:id/assign` | RBAC | Assign to branch |
| POST | `/staff/:id/unassign` | RBAC | Unassign from branch |
| PATCH | `/staff/:id/status` | RBAC | Update availability status |
| PATCH | `/staff/:id/avatar` | RBAC | Upload staff photo |
| POST | `/staff/:id/reset-commission` | RBAC | Reset to template commission rate |

### Attendance (sub-feature)

**API module:** `features/attendance/`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/attendance/clock-in` | RBAC | Clock in (with optional GPS) |
| POST | `/attendance/clock-out` | RBAC | Clock out |
| GET | `/attendance` | RBAC | Attendance log |
| GET | `/attendance/shifts` | RBAC | Shift schedules |
| POST | `/attendance/shifts` | RBAC | Create shift |
| DELETE | `/attendance/shifts/:id` | RBAC | Delete shift |

### Admin UI
- **Barber management** (`/barbers`) — table, create with user search combobox, update status, assign branch, avatar upload, reset commission
- **Attendance** (`/attendance`) — attendance log + shift schedule + weekly calendar view
- **Barber Portal** — role-gated pages for service providers:
  - My Schedule (`/my-schedule`) — today's queue entries
  - My Commissions (`/my-commissions`) — personal earnings
  - My Attendance (`/my-attendance`) — clock-in/out history

### Key Business Rules
- Staff tiers: Junior, Senior, Master (with per-tier pricing surcharges)
- Commission models: FLAT_PERCENTAGE, SLIDING_SCALE, BASE_PLUS_BONUS
- Auto clock-out at branch closing (cron job, flagged in audit)
- Clock-in only during branch operating hours

---

## 4. Queue & Scheduling

**API module:** `features/queue/`
**OpenSpec:** `api/queue`, `admin/queue`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/queue` | RBAC | List queue entries (branch-filtered) |
| POST | `/queue` | RBAC | Create queue entry (walk-in or online booking) |
| PATCH | `/queue/:id/status` | RBAC | Update status (WAITING→CALLED→IN_SERVICE→COMPLETED→AT_CHECKOUT→PAID) |
| POST | `/queue/:id/assign` | RBAC | Assign staff to entry |
| POST | `/queue/:id/postpone` | RBAC | Postpone entry |
| POST | `/queue/:id/cancel` | RBAC | Admin cancel |
| POST | `/queue/:id/customer-cancel` | Customer | Customer cancel (with cancellation policy for prepaid) |
| POST | `/queue/:id/reschedule` | Customer | Reschedule booking |
| GET | `/queue/availability` | Public | Available time slots for a branch |
| GET | `/queue/me` | Customer | Customer's upcoming bookings |

### Admin UI
- **Queue management** (`/queue`) — DnD Kanban board with lanes per status, real-time via Pusher

### Client UI
- **Booking flow** (`/book/:branchId`) — 4 steps: service selection → barber selection → time slot picker → confirm
- **Booking history** (`/history`) — upcoming/past/waitlist tabs, cancel/reschedule actions

### Queue State Machine

```
WAITING → CALLED → IN_SERVICE → COMPLETED → AT_CHECKOUT → PAID
                                                         ↗
WAITING → CANCELLED                     NO_SHOW ────────┘
CALLED → NO_SHOW (auto after 5 min)
```

### Key Business Rules
- Online bookings have priority over walk-ins
- Auto-assignment: barber with lowest estimated remaining work time
- 10-minute grace period → auto-release if customer doesn't show
- Surge pricing applied at booking time
- Overbooking prevention with 409 conflict on overlap
- NO_SHOW auto-transition after 5 minutes of being CALLED (cron)
- AT_CHECKOUT auto-creates draft transaction from booking items
- Real-time updates via Pusher/Soketi WebSocket (Listens to specific `user-${id}` and broadcast channels)
- Push notifications on CALLED and COMPLETED status transitions. (A foreground push notification event will automatically trigger a data refresh, serving as a robust fallback to WebSockets).

---

## 5. Waitlist

**API module:** `features/waitlist/`
**OpenSpec:** `api/waitlist`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/waitlist` | Customer | Join waitlist for a time slot |
| GET | `/waitlist/me` | Customer | Customer's waitlist entries |
| DELETE | `/waitlist/:id` | Customer | Leave waitlist |
| GET | `/waitlist` | RBAC | Admin: list all waitlist entries (branch-filtered) |

### Admin UI
- **Waitlist management** (`/waitlist`) — branch-filtered table of entries

### Client UI
- **Waitlist tab** in booking history — active entries with leave action
- **Join from time selection** — when no slots available

### Key Business Rules
- Org-configurable: `WAITLIST_ENABLED`, `WAITLIST_MAX_PER_SLOT`
- `WaitlistEntry` lifecycle: WAITING → NOTIFIED → CONVERTED / EXPIRED / CANCELLED
- Automatic expiry via cron (every 5 minutes)

---

## 6. Point of Sale (POS) & Transactions

**API module:** `features/transactions/`
**OpenSpec:** `api/transactions`, `admin/transactions`, `admin/pos`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/transactions` | RBAC | List transactions (branch, date, status filters) |
| GET | `/transactions/:id` | RBAC | Transaction detail |
| POST | `/transactions` | RBAC | Create transaction (services + products) |
| POST | `/transactions/:id/pay` | RBAC | Add payment(s) to transaction |
| POST | `/transactions/:id/void` | RBAC | Void transaction (with inventory reversal) |
| GET | `/transactions/daily-summary` | RBAC | Revenue/tips/count for a date |
| GET | `/transactions/:id/receipt` | Auth | Digital receipt data |

### Admin UI
- **POS checkout** (`/pos`) — services + products tabs, cart, discount (flat/%), tip, payment method selection (CASH/QRIS/CARD/DIGITAL_WALLET), dynamic tax from config. Offline fallback to IndexedDB with sync UI.
- **Transactions** (`/transactions`) — list with filters, pagination, detail modal, void action

### Client UI
- **Receipt page** (`/receipt/:transactionId`) — digital receipt with print CSS

### Key Business Rules
- `grossAmount = SUM(items) → discount → tax → netAmount → + tip = totalDue`
- Payment methods: CASH, QRIS, CARD, DIGITAL_WALLET
- Commission auto-calculated on PAID status
- Void requires SUPERVISOR+ permission, reverses inventory, creates audit log
- Loyalty points earned on completed transactions

### Known Gaps
- **GAP-35**: Split payment UI not implemented (API supports arrays, UI sends single payment)

---

## 7. Payments

**API module:** `features/payments/`
**OpenSpec:** `api/payments`, `client/payments`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/create-charge` | Auth | Create Xendit invoice/charge |
| POST | `/payments/webhook` | Public | Xendit callback (validates `X-Callback-Token`) |
| GET | `/payments/methods` | Customer | List saved payment methods |
| POST | `/payments/methods` | Customer | Save tokenized card (max 5) |
| DELETE | `/payments/methods/:id` | Customer | Remove saved card |

### Client UI
- **Payment methods** (`/payment-methods`) — card list, add via Xendit.js tokenization, delete

### Key Business Rules
- Xendit adapter abstracted behind payment interface (swappable)
- Card tokenization happens client-side via Xendit.js — no raw card data touches our server
- Max 5 saved cards per user; first card auto-set as default
- Optional prepayment for bookings (org-configurable)

---

## 8. Commission & Payroll

**API module:** `features/commissions/`, `features/payroll/`
**OpenSpec:** `api/commissions`, `api/payroll`, `admin/commissions`, `admin/payroll`

### Commission Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/commissions/calculate` | RBAC | Calculate commissions for a date range |
| POST | `/commissions/recalculate` | RBAC | Force recalculation |
| GET | `/commissions/earnings` | RBAC | List earnings (staff, date filters) |
| GET | `/commissions/earnings/me` | Staff | Staff's own earnings |

### Payroll Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payroll/generate` | RBAC | Generate payroll period |
| POST | `/payroll/:id/submit` | RBAC | Submit for approval |
| POST | `/payroll/:id/approve` | RBAC | Approve payroll |
| POST | `/payroll/:id/dispute` | RBAC | Dispute payroll |
| POST | `/payroll/:id/resolve` | RBAC | Resolve dispute |
| POST | `/payroll/:id/disburse` | RBAC | Mark as disbursed |
| POST | `/payroll/bulk-approve` | RBAC | Approve multiple periods |
| POST | `/payroll/bulk-disburse` | RBAC | Disburse multiple periods |

### Admin UI
- **Commissions** (`/commissions`) — earnings table with date/staff filters
- **Payroll** (`/payroll`) — period list with status badges, generate/submit/approve/dispute/disburse actions, bulk operations

### Payroll State Machine

```
DRAFT → PENDING_APPROVAL → APPROVED → DISBURSED
                         → DISPUTED → DRAFT (adjusted)
```

### Key Business Rules
- Three commission models: Flat %, Sliding Scale, Base + Bonus
- Tips distribution: PER_BARBER or POOLED (per branch setting)
- Config-driven template rates: COMMISSION_RATE_MASTER/SENIOR/JUNIOR
- Commission calculated on net service revenue (excluding products & tips)

---

## 9. Inventory

**API module:** `features/inventory/`
**OpenSpec:** `api/inventory`, `admin/inventory`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/inventory/products` | RBAC | List products |
| POST | `/inventory/products` | RBAC | Create product |
| PATCH | `/inventory/products/:id` | RBAC | Update product |
| DELETE | `/inventory/products/:id` | RBAC | Delete product |
| GET | `/inventory/branches/:branchId` | RBAC | Branch stock levels |
| POST | `/inventory/branches/:branchId/stock-in` | RBAC | Stock in |
| POST | `/inventory/branches/:branchId/stock-out` | RBAC | Stock out |
| POST | `/inventory/branches/:branchId/adjust` | RBAC | Stock adjustment |
| GET | `/inventory/branches/:branchId/movements` | RBAC | Stock movement history |
| GET | `/inventory/branches/:branchId/alerts` | RBAC | Low stock alerts |
| GET | `/inventory/branches/:branchId/valuation` | RBAC | Inventory valuation (COGS) |

### Admin UI
- **Inventory** (`/inventory`) — product table with branch selector, stock-in/stock-out/adjust dialogs per product row, low-stock alerts. Products tab with create/edit/delete.

### Key Business Rules
- COGS via weighted average cost method
- Low-stock alerts when quantity drops below reorder threshold
- Stock movements logged (IN, OUT, ADJUST with reason)
- Product sales through POS auto-deduct stock

---

## 10. Cash Drawer

**API module:** `features/cash-drawer/`
**OpenSpec:** `api/cash-drawer`, `admin/cash-drawer`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/cash-drawer/open` | RBAC | Open drawer session |
| POST | `/cash-drawer/close` | RBAC | Close drawer with counted cash |
| GET | `/cash-drawer/current` | RBAC | Current session status |
| POST | `/cash-drawer/entry` | RBAC | Add cash entry (in/out) |

### Admin UI
- **Cash drawer** (`/cash-drawer`) — open/close flow, running total, entries list, end-of-day discrepancy summary

---

## 11. Services & Catalog

**API module:** `features/services/`
**OpenSpec:** `api/services`, `admin/services`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/services` | Public | List services (with branch overrides) |
| GET | `/services/:id` | Public | Service detail |
| POST | `/services` | RBAC | Create service (Super Admin only) |
| PATCH | `/services/:id` | RBAC | Update service |
| DELETE | `/services/:id` | RBAC | Soft-delete service |
| POST | `/services/:id/tier-surcharges` | RBAC | Set tier surcharges |
| POST | `/services/:id/combos` | RBAC | Create combo from services |
| POST | `/services/:id/branch-overrides` | RBAC | Set branch price override or disable |

### Admin UI
- **Service catalog** (`/services`) — CRUD table, tier surcharges, combos, branch overrides

### Key Business Rules
- Global catalog managed by Super Admin; branches inherit all services
- Branches can only override price or disable — cannot create new services
- Tier surcharges: Junior +0, Senior +15K, Master +30K (configurable)
- Combos: bundle multiple services at discounted price
- Duration = SUM(included durations) + MAX(buffers)

### Known Gaps
- **GAP-36**: Add-ons described in business_logic.md but not fully implemented as first-class feature

---

## 12. Loyalty & Referrals

**API module:** `features/loyalty/`, `features/referrals/`
**OpenSpec:** `api/loyalty`, `api/referrals`, `admin/loyalty`, `client/loyalty`

### Loyalty Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/loyalty/me` | Customer | My loyalty account (points, tier) |
| GET | `/loyalty/me/history` | Customer | Points transaction history |
| POST | `/loyalty/redeem` | Customer | Redeem points for discount |
| GET | `/loyalty/:userId` | RBAC | Admin: lookup customer loyalty |
| PATCH | `/loyalty/admin/adjust` | RBAC | Admin: add/deduct points |
| POST | `/loyalty/admin/expire` | RBAC | Admin: run point expiry manually |

### Referral Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/referrals/me/code` | Customer | Get my referral code |
| POST | `/referrals/apply` | Customer | Apply a referral code |
| GET | `/referrals/me/history` | Customer | My referral history |
| GET | `/referrals/stats` | RBAC | Admin: referral program stats |

### Admin UI
- **Loyalty management** (`/loyalty`) — referral stats, customer lookup, manual point add/deduct, run point expiry

### Client UI
- **Loyalty page** (`/loyalty`) — LoyaltyCard (points/tier), TierProgressBar, PointsHistoryList, ReferralShareCard

### Key Business Rules
- Points earned per transaction: `FLOOR(netAmount / pointsEarnRate)`
- Tier progression: Bronze → Silver → Gold → Platinum (never downgrades)
- Tier multipliers on earn rate (1.0×, 1.25×, 1.5×, 2.0×)
- Points expire after configurable inactivity window
- Referral: auto-generated code, bonus on first purchase by referee
- Referral expiry: configurable via `REFERRAL_EXPIRY_DAYS`

---

## 13. Reviews

**API module:** `features/reviews/`
**OpenSpec:** `api/reviews`, `admin/reviews`, `client/reviews`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reviews` | Customer | Create review (1-5 stars + text + photos) |
| GET | `/reviews` | Public | List reviews (branch/staff filters) |
| GET | `/reviews/:id` | Public | Review detail |
| PATCH | `/reviews/:id/moderate` | RBAC | Moderate review (show/hide/notes) |
| DELETE | `/reviews/:id` | RBAC | Delete review |

### Admin UI
- **Reviews moderation** (`/reviews`) — review table with rating filter, branch selector, show/hide toggle, moderation notes

### Client UI
- **Post review dialog** — on receipt page + history pages
- **Review feed** — on branch and barber detail views
- Components: StarRatingInput, ReviewCard, ReviewSummary, ReviewForm

---

## 14. CRM & Customer Insights

**API module:** `features/crm/`
**OpenSpec:** `api/crm`, `admin/crm`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/crm/customers` | RBAC | Customer list with visit frequency, spend, last visit |
| GET | `/crm/customers/:id` | RBAC | Customer detail |
| GET | `/crm/segments` | RBAC | Customer segments (VIP, At-Risk, New, Lapsed) |
| POST | `/crm/segments/recompute` | RBAC | Recompute segment assignments |

### Admin UI
- **CRM dashboard** (`/crm`) — customer table with segment filter, recompute action, customer detail dialog

---

## 15. Campaigns & Promotions

**API module:** `features/campaigns/`, `features/promotions/`
**OpenSpec:** `api/campaigns`, `api/promotions`

### Campaign Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/campaigns` | RBAC | List campaigns |
| POST | `/campaigns` | RBAC | Create campaign |
| PATCH | `/campaigns/:id` | RBAC | Update campaign |
| DELETE | `/campaigns/:id` | RBAC | Delete campaign |
| POST | `/campaigns/:id/send` | RBAC | Send campaign (push notifications) |

### Promotion Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/promotions` | RBAC | List promo codes |
| POST | `/promotions` | RBAC | Create promo code |
| PATCH | `/promotions/:id` | RBAC | Update promo code |
| DELETE | `/promotions/:id` | RBAC | Delete promo code |
| POST | `/promotions/validate` | Auth | Validate promo code at checkout |

### Admin UI
- **Campaign management** (`/campaigns`) — CRUD, send action, status badges, branch filter

### Known Gaps
- **GAP-33**: Promotions/promo code management has no admin UI — API endpoints work but no page exists

---

## 16. Retention

**API module:** `features/retention/`
**OpenSpec:** `api/retention`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/retention/trigger` | RBAC | Manually run retention triggers |
| GET | `/retention/stats` | RBAC | Retention statistics |

### Admin UI
- **Retention management** (`/retention`) — stats cards, trigger policy info, manual "Run Retention Triggers" with confirmation

### Key Business Rules
- Daily cron (03:05 UTC) identifies at-risk customers and sends nudge notifications
- Two trigger types: at-risk (no visit in X days) and points-expiry warning
- Notifications sent via OneSignal push

---

## 17. Notifications

**API module:** `features/notifications/`
**OpenSpec:** `api/notifications`, `client/notifications`

### User Inbox Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | Auth | Paginated notification inbox |
| GET | `/notifications/unread-count` | Auth | Unread count for badge |
| PATCH | `/notifications/:id/read` | Auth | Mark notification as read |
| POST | `/notifications/mark-all-read` | Auth | Mark all as read |

### Channel/Preference Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications/preferences` | Auth | User push/WhatsApp/SMS/email preferences |
| PUT | `/notifications/preferences` | Auth | Update preferences (with emailOptOut) |
| GET | `/notifications/channels` | RBAC | Admin: channel config per notification type |
| PUT | `/notifications/channels/:type` | RBAC | Admin: toggle push/WhatsApp/SMS/email per type |

### Admin Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications/admin` | RBAC | Org-wide notification list |
| GET | `/notifications/admin/stats` | RBAC | Aggregate stats |
| POST | `/notifications/admin/test-send` | RBAC | Test push notification |

### Admin UI
- **Notification management** (`/notifications`) — org-wide list, type filter, stats cards, test-send dialog

### Client UI
- **Notifications page** (`/notifications`) — paginated list, mark read
- **Bell icon** with unread count badge on home page
- **Notification settings** (`/settings/notifications`) — push/WhatsApp/SMS/email opt-out toggles

### Push Notification Triggers

| Event | When | Push Title |
|-------|------|-----------|
| Booking confirmed | Queue entry created | "Booking Confirmed!" |
| Your turn | Status → CALLED | "Your Turn Is Coming!" |
| Service complete | Status → COMPLETED | "Service Complete" |
| Appointment reminder | 30 min before (cron) | "Upcoming Appointment" |
| Retention nudge | Daily cron | At-risk / expiry message |
| Campaign send | Manual trigger | Campaign title |

### Email Notification Strategy

All user-facing transactional emails are dispatched via Resend. HTML templates are built using the shared `@tmng/email-templates` package, ensuring consistent branding with branch headers and footers. SMTP remains reserved exclusively for scheduled report delivery.

| Tier | Event | Priority | Template |
|------|-------|---------|----------|
| **Tier 1 — Transactional** | Booking Confirmed, Cancelled, Rescheduled, Payment Receipt | Critical — always sent | `bookingReceiptEmail`, `paymentReceiptEmail` |
| **Tier 2 — Engagement** | 24h Appointment Reminder, Waitlist Slot Available | Respects user preferences | TBD |
| **Tier 3 — Marketing** | Campaign send, Retention Nudge | Respects user preferences | TBD |

See `business_logic.md §10.3` for the full trigger table. Email opt-out is managed via `emailOptOut` in user preferences.

---

## 18. Analytics & Dashboards

**API module:** `features/analytics/`
**OpenSpec:** `api/analytics`, `admin/analytics`, `admin/dashboard`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/dashboard` | RBAC | Multi-branch overview (status, revenue, alerts) |
| GET | `/analytics/comparison` | RBAC | Branch comparison (revenue, ratings, volume) |
| GET | `/analytics/heatmap` | RBAC | Peak hours heatmap (7×24 grid) |
| GET | `/analytics/retention` | RBAC | Cohort retention analysis |
| GET | `/analytics/utilization` | RBAC | Per-staff utilization rates |
| GET | `/analytics/demand-forecast` | RBAC | 14-day demand predictions per branch |
| POST | `/analytics/demand-forecast/compute` | RBAC | Trigger forecast computation |
| GET | `/analytics/churn-scores` | RBAC | Customer churn risk scores |
| POST | `/analytics/churn-scores/compute` | RBAC | Trigger churn scoring |
| GET | `/analytics/churn-scores/:customerId` | RBAC | Individual customer churn detail |
| GET | `/analytics/schedule-suggestions` | RBAC | Smart scheduling suggestions |
| POST | `/analytics/schedule-suggestions/:id/accept` | RBAC | Accept suggestion (creates shift) |
| POST | `/analytics/schedule-suggestions/:id/reject` | RBAC | Reject suggestion |
| GET | `/analytics/revenue-trend` | RBAC | Revenue over time (7/14/30d) |
| POST | `/analytics/snapshots/compute` | RBAC | Manually trigger snapshot |

### Admin UI
- **Dashboard** (`/`) — daily summary cards, revenue trend line chart, payment donut, volume bars
- **Analytics** (`/analytics`) — 7 tabs: Overview, Comparison, Peak Hours, Retention, Utilization, Forecast, Churn Risk, Smart Schedule

### Key Business Rules
- Nightly snapshot cron computes `BranchDailySnapshot` for historical analytics
- Demand forecast: time-series decomposition (7-day MA, seasonal indices, linear regression)
- Churn prediction: weighted RFM scoring (recency 0.35, frequency 0.30, monetary 0.20, engagement 0.15)
- Smart scheduling: demand-capacity matching, accept auto-creates ShiftSchedule

---

## 19. Reports

**API module:** `features/reports/`
**OpenSpec:** `api/reports`, `admin/reports`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/generate` | RBAC | Generate report (5 types) |
| GET | `/reports/export/csv` | RBAC | Export as CSV |
| GET | `/reports/export/pdf` | RBAC | Export as PDF (pdfkit) |
| GET | `/reports/schedules` | RBAC | List report schedules |
| POST | `/reports/schedules` | RBAC | Create scheduled report |
| PATCH | `/reports/schedules/:id` | RBAC | Update schedule |
| DELETE | `/reports/schedules/:id` | RBAC | Delete schedule |
| GET | `/reports/templates` | RBAC | List saved report templates |
| POST | `/reports/templates` | RBAC | Save template |
| DELETE | `/reports/templates/:id` | RBAC | Delete template |

### Report Types
1. Daily Revenue (services vs retail breakdown)
2. Service Popularity (rankings, trends)
3. Staff Leaderboard (revenue, transactions, ratings)
4. Customer Visits (frequency distribution)
5. Booking Source Analysis (online vs walk-in ratio)

### Admin UI
- **Reports** (`/reports`) — 3 tabs: Generate, Schedules, Templates. CSV + PDF export, scheduled email delivery.

### Key Business Rules
- PDF generation via `pdfkit` with org currency formatting
- Scheduled reports: DAILY/WEEKLY/MONTHLY frequency, processed hourly by cron
- Email delivery via `nodemailer` SMTP with PDF + CSV attachments
- Saved templates store filter presets for reuse

---

## 20. Financial Oversight

**API module:** `features/finance/`
**OpenSpec:** `api/finance`, `admin/finance`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/finance/pnl` | RBAC | P&L summary (revenue, costs, gross profit, margins) |
| GET | `/finance/payroll` | RBAC | Payroll oversight |
| GET | `/finance/tax` | RBAC | Tax summary |
| GET | `/finance/voids` | RBAC | Void and discount audit |

### Admin UI
- **Financial oversight** (`/finance`) — P&L summary cards, revenue/cost breakdown bars, void/discount cards

---

## 21. Audit & Anomaly Detection

**API module:** `features/audit/`
**OpenSpec:** `api/audit`, `admin/audit`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audit/logs` | RBAC | Filterable audit log (branch, user, action, date) |
| GET | `/audit/anomalies` | RBAC | Anomaly flags |
| GET | `/audit/anomalies/stats` | RBAC | Anomaly statistics |
| PATCH | `/audit/anomalies/:id/resolve` | RBAC | Resolve anomaly |

### Admin UI
- **Audit log** (`/audit`) — filterable table, expandable detail rows, anomaly dashboard with severity cards, resolve dialog

### Key Business Rules
- All state-changing actions logged: timestamp, userId, role, branch, action, entity, details
- Anomaly detection cron (every 15 min): excessive voids, high discounts, off-hours clock-ins
- Immutable audit log (append-only)

---

## 22. User & Role Management

**API module:** `features/users/`, `features/roles/`
**OpenSpec:** `api/users`, `api/roles`, `admin/users`

### User Management Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | RBAC | List users (with role, branch, status) |
| GET | `/users/:id` | RBAC | User detail |
| PATCH | `/users/:id/role` | RBAC | Change user's tenant role |
| POST | `/users/:id/assign-branch` | RBAC | Assign to branch |
| POST | `/users/:id/remove-branch` | RBAC | Remove branch assignment |
| POST | `/users/:id/deactivate` | RBAC | Deactivate user |
| POST | `/users/:id/reactivate` | RBAC | Reactivate user |

### Role Management Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/roles` | RBAC | List tenant roles |
| POST | `/roles` | RBAC | Create tenant role |
| PATCH | `/roles/:id` | RBAC | Update role (name, scope, permissions) |
| GET | `/roles/:id/permissions` | RBAC | Get role permission matrix |
| PUT | `/roles/:id/permissions` | RBAC | Update permission matrix |

### Admin UI
- **User management** (`/users`) — searchable table, role change dialog, branch assignment, activate/deactivate

### Known Gaps
- **GAP-34**: No admin page for role CRUD or permission matrix editing — role management is API-only

---

## 23. Organization Config

**API module:** `features/config/`
**OpenSpec:** `api/config`, `admin/config`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/config` | RBAC | List all org config keys with values |
| PATCH | `/config/:key` | RBAC | Update a config key |

### Admin UI
- **Platform settings** (`/config`) — grouped config form: Loyalty, Referrals, POS & Tax, Commission Templates, Customer Self-Service (prepayment, deposit %, cancellation policy, waitlist)

### Config Keys (17 default)
Loyalty (earn rate, redeem rate, tier thresholds, expiry), Referrals (bonus points, expiry days), POS (tax rate), Commissions (per-tier rates), Customer Self-Service (prepayment enabled, deposit %, cancellation hours, penalty %, waitlist enabled, max per slot)

---

## 24. Platform Admin

**API module:** `features/platform/`
**OpenSpec:** `api/platform`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/platform/auth/login` | Public | Platform admin login |
| GET | `/platform/orgs` | Platform | List organizations |
| POST | `/platform/orgs` | Platform | Create organization |
| PATCH | `/platform/orgs/:id` | Platform | Update organization |
| GET | `/platform/templates` | Platform | Industry templates |
| GET | `/platform/features` | Platform | Feature catalog (25 features) |

### Admin UI
- **None** — Platform admin is API-only by design. Operations managed by TMNG internal staff via API.

---

## 25. Media Upload

**API module:** `features/media/`
**OpenSpec:** `api/media`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/media/upload` | Auth | Upload file (multipart, 5MB limit, MIME + magic bytes validation) |
| DELETE | `/media` | Auth | Delete file from S3 |

Used by: staff avatar upload, branch image upload, review photos, product photos.

---

## 26. Health & Monitoring

**API module:** `features/health/`
**OpenSpec:** `api/health`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | System health (uptime, memory, DB pool stats, API version) |

Returns: success, status, timestamp, version, uptime (seconds), memory (rss/heapUsed/heapTotal), DB pool stats (total/idle/waiting).

---

## 27. i18n (Internationalization)

**OpenSpec:** `admin/i18n`, `client/i18n`

Frontend-only implementation via `react-i18next`:
- **Languages:** English (en), Indonesian (id)
- **Namespace files:** Per-feature JSON files in `src/i18n/locales/{en,id}/`
- **Admin:** 29 namespace files per language + language switcher in sidebar
- **Client:** 13 namespace files per language + language switcher in profile
- **No server-side translation layer** — all translations are in frontend JSON bundles
