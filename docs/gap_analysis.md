# Gap Analysis: Phases 1–7

> Cross-reference of every item in [implementation_plan.md](implementation_plan.md) and [business_logic.md](business_logic.md) against the actual codebase and all sprint documents (P4, P5, P6, P7).
>
> **Last updated:** Mar 9, 2026 — Admin UI & Offline POS Sprint: Dynamic TAX_RATE (org config), POS product sales tab, inventory stock adjustment UI, user branch dropdown, DIGITAL_WALLET payment, offline sync UI (pending/failed/retry/cleanup), admin PWA (vite-plugin-pwa), analytics utilization endpoint & tab, attendance calendar view, commission template config. GAP-18 and GAP-24 resolved.

**Resolved in Bug Fix sprint:** GAP-03 (Account Deletion API — DELETE /auth/me + client wired), GAP-05 (Rate Limiting — middleware applied to auth and global routes), GAP-12 (Surge pricing wired in queue.service), GAP-14 (Real-time slot availability — GET /queue/availability + client time picker), GAP-15 (Overbooking prevention in createEntry), GAP-25 (Combo duration/buffer fix). PromoCode CRUD completed (Update + Delete added). Forgot password page and POST /auth/forgot-password added.

**Resolved in Gap Resolution Sprint:** Admin Dashboard fully built (11 pages), real-time queue Kanban board, barber management, attendance/shifts, branch settings, transactions, POS checkout, commission/payroll/inventory screens, global branch selector, client loyalty display, client booking navigation fixes, Axios API client with token refresh interceptors.

**New gaps identified (Feb 2026):** GAP-26 (Client route protection), GAP-27 (Client Pusher/WebSocket hook), GAP-28 (PWA service worker/manifest).

**Resolved in Client Hardening Sprint:** GAP-26 (ProtectedRoute in client app), GAP-28 (vite-plugin-pwa with Workbox), GAP-16 (Customer cancel/reschedule API + UI), Phase 4 Task 6 (Digital receipt frontend).

**Resolved in Tier 1 Polish Sprint:** GAP-08 (NO_SHOW timeout via node-cron), GAP-19 (Auto clock-out at branch closing via node-cron), Payroll barber name resolution, BranchSelector always-visible polish, seed.ts transactional data cleanup.

**Resolved in Tier 2+4 Sprint:** GAP-10 (Barber Portal — role-gated admin routes), GAP-11 (Cash Drawer Reconciliation — full API + UI), GAP-17 (Favorite Branch — schema + API + client toggle), GAP-20 (Tips Distribution — PER_BARBER/POOLED config + commission logic), GAP-22 (DB Backup — pg_dump scripts + cron + docs). Also: Kanban DnD fix (droppable lanes), Add Barber UX (user search combobox), type-safety cleanup (42 `as any` removed).

**Kanban DnD Optimistic Update:** Smooth cross-lane drag with `onDragOver` handler, `overrideLane` state for live visual updates, optimistic TanStack Query cache update in `useUpdateQueueStatus` (`onMutate`/`onError`/`onSettled`), and `handleDragCancel` for state cleanup.

**Resolved in Phase 7 SaaS Refactor:** Database-driven RBAC, multi-tenant organization model, generic naming (barber → staff), platform admin, tenant role management.

**Resolved in Phase 5 Backend Sprint:** Phase 5 Tasks 0-6 fully implemented — Loyalty Points Engine (earn/redeem/expiry/tier progression), Referral Program (auto-generated codes, first-purchase completion trigger), Ratings & Reviews (create/moderate/aggregate), Branch CRM (customer insights, auto-segmentation), Campaign Engine (CRUD + lifecycle), Retention Triggers (at-risk/expiry nudges via node-cron).

**Resolved in Frontend RBAC Sprint (Mar 2026):** API `/auth/me` and `/auth/login` now return full `permissions` matrix. Admin sidebar filters menu items by feature permission (replaces role/scope checks). Route-level `<RequirePermission>` guards prevent URL-based access to unauthorized pages. Barber dashboard shows queue/commission data instead of failing TRANSACTION read call. Client fixes: `navigate('/branches')` → `'/book'`, Pusher query key `["history"]` → `["my-bookings"]`, `useCreateBooking` invalidates cache on success.

**Resolved in Admin UI & Offline POS Sprint (Mar 2026):** GAP-18 (Chair Utilization — GET /analytics/utilization with per-barber utilization rates, admin utilization tab). GAP-24 (Commission Templates — COMMISSION_RATE_MASTER/SENIOR/JUNIOR config keys, Config panel section). POS product sales tab alongside services, DIGITAL_WALLET payment method. Dynamic TAX_RATE reads from Organization.taxRate (API) and config API (admin). Inventory stock-in/out/adjust dialogs in admin. User branch assignment dropdown (replaced free-text). Offline POS sync UI (pending/failed counts, sync now, retry failed, 7-day cleanup). Admin app PWA via vite-plugin-pwa. Weekly calendar view on attendance page.

**Resolved in Phase 5 Frontend + Ops Gaps Sprint:** GAP-06 (Emergency Closure — schema `isEmergencyClosed` + API endpoints + admin UI toggle + client "Temporarily Closed" badge + queue/slot blocking), GAP-07 (Holiday Calendar — `BranchHoliday` model + CRUD API + admin Holidays tab + slot availability integration), GAP-09 (Grace Period Auto-Release — scheduler cron job releases late online bookings after 10 min), GAP-27 (Client Pusher Hook — ported `usePusherChannel` to client app, wired into booking history). Phase 5 Tasks 7-8 frontend already existed: loyalty dashboard (LoyaltyCard, TierProgressBar, PointsHistoryList, ReferralShareCard), reviews UI (PostReviewDialog on receipt + history pages, ReviewFeed on branch/barber pages).

---

## Coverage Summary

| Phase | Sprint Doc | Status |
|-------|-----------|--------|
| Phase 1: Foundation | N/A (completed) | ✅ Built |
| Phase 2: Branch Operations | N/A (completed) | ✅ Built |
| Phase 3: Client Application | N/A (completed) | ✅ Built |
| Phase 4: Financial & Workforce | [phase4_sprint.md](docs/phase4_sprint.md) | 🔶 Tasks 0-4, 6, 8-15 done; Tasks 5, 7 partial |
| Phase 5: Loyalty & Engagement | [phase5_sprint.md](docs/phase5_sprint.md) | ✅ Complete (Tasks 0-8 all done) |
| Phase 6: Super Admin & Analytics | [phase6_sprint.md](docs/phase6_sprint.md) | ✅ Complete |

---

## 🔴 CRITICAL — Blocking Features Not in Any Sprint

### GAP-01: OAuth Login (Google, Apple) — 🔶 Partially Resolved

- **Spec ref:** 1.1.2
- **Current state:** Google OAuth implemented in Phase 7 (`POST /api/auth/google`). Decodes Google ID token, find-or-creates user, links Google to existing email accounts. `AuthProvider` enum and `googleId` field exist in schema.
- **Remaining:** Google token verification is dev-only (base64 decode, no server-side JWKS verification). Apple OAuth not implemented.
- **Impact:** Google login works for development. Apple Sign In required for iOS App Store if using Capacitor.

> [!CAUTION]
> Apple Sign In requires an Apple Developer account ($99/year) and is mandatory for iOS App Store apps. If this project will be wrapped in Capacitor/native, Apple Sign In is a **hard requirement**.

---

### GAP-02: Phone Number Verification (OTP)

- **Spec ref:** 1.1.3
- **Current state:** `User.phone` field exists but is optional and unverified. No OTP system.
- **Impact:** Needed for WhatsApp notifications (future) and as an alternative auth method in Indonesia where phone > email.
- **Assigned to:** ❌ **No sprint**

**Recommended fix — Phase 5 add-on:**

```text
Steps:
1. Choose OTP provider: Twilio Verify, Vonage, or Firebase Auth (cheapest for Indonesia)
2. Add API endpoints:
   - POST /auth/otp/send   — sends 6-digit OTP via SMS to phone
   - POST /auth/otp/verify — validates OTP, marks phone as verified
3. Schema: add `isPhoneVerified Boolean @default(false)` to User model
4. Add OTP adapter interface (similar to payment gateway adapter) for provider swapping
5. Rate limit: max 3 OTP requests per phone per hour
6. Environment vars: OTP_PROVIDER, OTP_API_KEY
```

---

### ~~GAP-03: Account Deletion API~~ ✅ RESOLVED

- **Spec ref:** Implementation plan gap #19, GDPR/privacy compliance
- **Current state:** **Fixed.** DELETE /auth/me implemented (anonymize user, deactivate, delete refresh tokens & loyalty account, audit log). Client "Delete Account" button wired with confirmation dialog.
- **Note:** `profile-page.tsx` migrated from `window.confirm` to the global `useConfirmation` hook (`components/ui/confirmation.tsx`).
- **Assigned to:** Bug Fix sprint (done).

---

### ~~GAP-04: MinIO Media Upload Service~~ ✅ RESOLVED (Phase 5 Backend Sprint)

- **Spec ref:** 5.4, 2.3.1 (staff photos), 1.5.2 (review photos), 2.5.1 (product photos)
- **Current state:** **Fixed.** `features/media/media.handlers.ts` implements `POST /api/media/upload` with full S3/MinIO integration via `@aws-sdk/client-s3`. Validates MIME type, file size (5MB limit), and magic bytes. `utils/s3.ts` provides `uploadFile`, `deleteFile`, and `buildPublicUrl`. `DELETE /api/media` removes files from S3. Both routes are auth-protected and org-scoped.
- **Assigned to:** Phase 5 Backend Sprint (done).

---

### ~~GAP-05: Rate Limiting Middleware~~ ✅ RESOLVED

- **Spec ref:** 5.5 ("rate limiting"), 5.6 ("Rate limiting on auth endpoints")
- **Current state:** **Fixed.** `middlewares/rate-limit.ts` added; auth endpoints (login 5/min, register 3/min, refresh 10/min) and global 100/min applied in `index.ts`.
- **Assigned to:** Bug Fix sprint (done).

---

## 🟠 HIGH — Features Missing from All Sprints

### ~~GAP-06: Emergency Closure Toggle~~ ✅ Resolved (Phase 5 Frontend + Ops Gaps Sprint)

- **Spec ref:** 2.8.2
- **Current state:** **Fixed.** `isEmergencyClosed Boolean @default(false)` added to Branch model. `POST /branches/:id/emergency-close` cancels all active queue entries and today's bookings in a transaction, creates `EMERGENCY_CLOSURE` audit log, fires Pusher event. `POST /branches/:id/reopen` reverses with `BRANCH_REOPENED` audit. Admin UI has emergency close button (with confirmation) in branch details + reopen banner. Client shows "Temporarily Closed" badge and disables booking. Queue service rejects new entries (403) and returns empty slots when branch is emergency-closed.
- **Assigned to:** Phase 5 Frontend + Ops Gaps Sprint (done)

---

### ~~GAP-07: Holiday Calendar~~ ✅ Resolved (Phase 5 Frontend + Ops Gaps Sprint)

- **Spec ref:** 2.8.1
- **Current state:** **Fixed.** `BranchHoliday` model added with `@@unique([branchId, date])`. CRUD endpoints under `/branches/:id/holidays` (public GET, MANAGER+ for CUD). `getAvailableSlots()` checks holidays — returns empty slots if `isClosed`, uses `openTime`/`closeTime` overrides for special hours. Admin UI has "Holidays" tab in branch settings with add/delete and date picker. `listHolidays` is public for client-side awareness.
- **Assigned to:** Phase 5 Frontend + Ops Gaps Sprint (done)

---

### GAP-08: NO_SHOW Timeout Automation ✅ RESOLVED

- **Spec ref:** business_logic.md §1.3 ("if CALLED but doesn't respond within 5 min → auto NO_SHOW")
- **Current state:** **Fixed.** `node-cron` scheduled job runs every 5 minutes in `scheduler.ts`. Finds all `CALLED` queue entries with `calledAt` older than 5 minutes and transitions them to `NO_SHOW`. Fires Pusher event to update the admin queue board in real time. Interval tuned from 1 min to 5 min to reduce DB pressure on remote connections.
- **Assigned to:** Tier 1 Polish Sprint (done).

---

### ~~GAP-09: Grace Period + Auto-Release for Online Bookings~~ ✅ Resolved (Phase 5 Frontend + Ops Gaps Sprint)

- **Spec ref:** business_logic.md §1.1 ("10-minute grace period → auto-release → barber AVAILABLE")
- **Current state:** **Fixed.** `processGracePeriodRelease()` cron job runs every 5 minutes in `scheduler.ts`. Finds online bookings (`source: APP/WEB`) with `status: WAITING` and `scheduledAt + 10 min < NOW()`. Transitions to `NO_SHOW`, sets assigned barber to `AVAILABLE`, fires Pusher event, creates audit log per entry.
- **Assigned to:** Phase 5 Frontend + Ops Gaps Sprint (done)

---

### ~~GAP-10: Barber Portal (Self-Service)~~ ✅ Resolved (Tier 2+4 Sprint)

- **Spec ref:** Phase 2 table mentions "Barber Portal: Lightweight RBAC-gated view — personal schedule, earnings, clock-in"
- **Resolution:** Implemented Option A — added BARBER to admin app allowed roles, role-gated sidebar (barbers see My Schedule, My Commissions, My Attendance), three new pages in `apps/admin/src/pages/barber-portal/`. Uses existing queue, commissions, and attendance APIs with barber ID filter.

---

### ~~GAP-11: End-of-Day Cash Drawer Reconciliation~~ ✅ Resolved (Tier 2+4 Sprint)

- **Spec ref:** 2.2.9, `task.md` lists it as §4.11
- **Resolution:** Implemented CashDrawerSession/CashDrawerEntry models, API endpoints (open/close/current/entry) in `features/cash-drawer/`, admin UI page with open/close flow, running total, entries list, and discrepancy summary. Role-gated to CASHIER+.

---

## 🟡 MEDIUM — Incomplete or Partially Implemented

### ~~GAP-12: Surge Pricing Not Applied in Booking Flow~~ ✅ RESOLVED

- **Spec ref:** 2.8.4, business_logic.md §7
- **Current state:** **Fixed.** `queue.service.ts` now loads active `SurgeRule` records for the branch, matches by day-of-week and hour range (in WIB), and applies the `surgeMultiplier` to each item price during booking.
- **Impact:** Resolved — surge pricing is active.

---

### ~~GAP-13: OneSignal Backend Integration (Server-Side Push)~~ ✅ RESOLVED (Phase 5 Backend Sprint)

- **Spec ref:** 1.6, 5.2
- **Current state:** **Fixed.** `utils/notifications.ts` implements `createNotificationService()` with OneSignal REST API v1. Uses `include_aliases: { external_id: [userId] }` for targeted push. Falls back to `console.log` no-op when env vars are not configured. Currently wired into retention triggers (`processRetentionTriggers` cron). Env vars: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`.
- **Note:** Server-side push is implemented but not yet wired into all core flows (booking confirmations, queue status updates, appointment reminders). Only retention nudges use it currently.
- **Assigned to:** Phase 5 Backend Sprint (done).

---

### ~~GAP-14: Real-Time Slot Availability for Online Booking~~ ✅ RESOLVED

- **Spec ref:** 1.3.3 ("Real-Time Availability & Time Slot Picker")
- **Current state:** **Fixed.** `GET /queue/availability` endpoint added (public, no auth required). Calculates available time slots based on branch operating hours and existing bookings. Client `useAvailability` hook fetches slots, and the `TimeSelection` component displays them with available/taken indicators.
- **Impact:** Resolved — customer booking flow shows real-time slot availability.

---

### ~~GAP-15: Overbooking Prevention & Conflict Detection~~ ✅ RESOLVED

- **Spec ref:** 2.1.7
- **Current state:** **Fixed.** `queue.service.ts` `createEntry()` now checks for overlapping bookings when a barber is assigned. It loads existing entries for the barber (excluding CANCELLED/NO_SHOW), computes start/end times, and throws `HTTPException(409, "Time slot already booked")` on overlap.
- **Impact:** Resolved — double-bookings are prevented.

---

### ~~GAP-16: Booking Reschedule & Cancellation API~~ ✅ Resolved (Client Hardening Sprint)

- **Spec ref:** 1.3.6
- **Resolution:** Customer-facing cancel (`POST /queue/:id/customer-cancel`) and reschedule (`POST /queue/:id/reschedule`) endpoints implemented with CUSTOMER ownership validation. Client booking history page includes cancel/reschedule actions for upcoming bookings.

---

### ~~GAP-17: Favorite Branch~~ ✅ Resolved (Tier 2+4 Sprint) — Removed in Phase 7

- **Spec ref:** 1.2.4
- **Resolution:** Added `favoriteBranchId` field to User model, `PATCH /auth/me/favorite-branch` endpoint, heart toggle on client branch discovery page. **Removed in Phase 7 SaaS refactor:** `favoriteBranchId` field removed from User model, replaced by org-level preferences.

---

### ~~GAP-18: Chair Utilization Rate Tracking~~ ✅ RESOLVED (Admin UI & Offline POS Sprint)

- **Spec ref:** 2.3.5, business_logic.md §5.2
- **Current state:** **Fixed.** `GET /analytics/utilization` endpoint calculates per-barber cutting time vs available time using `StaffAttendance` clock-in/out records and `QueueEntry` `startedAt`/`completedAt` timestamps. Returns `utilizationRate` per barber and overall rate. Admin analytics dashboard has a "Utilization" tab with per-barber utilization bars (color-coded by rate) and summary stats.
- **Assigned to:** Admin UI & Offline POS Sprint (done).

---

### ~~GAP-19: Auto-Clock-Out at Branch Closing~~ ✅ RESOLVED

- **Spec ref:** business_logic.md §5.1 ("If barber forgets to clock-out, auto-clock-out at branch closing time, flagged in audit")
- **Current state:** **Fixed.** `node-cron` scheduled job runs every 15 minutes in `scheduler.ts`. For each branch past its closing time, finds barbers still clocked in and sets `clockOut` to the branch closing time with `autoClockOut: true`. Interval tuned from 5 min to 15 min to reduce DB pressure on remote connections.
- **Assigned to:** Tier 1 Polish Sprint (done).

---

### ~~GAP-26: Client App Route Protection (ProtectedRoute)~~ ✅ Resolved (Client Hardening Sprint)

- **Spec ref:** General security requirement
- **Resolution:** `ProtectedRoute` component created in client app. Checks `useSessionStore().isAuthenticated`, redirects to `/login` with return URL. All authenticated routes (`/profile`, `/book`, `/history`, `/receipt`) are wrapped. Public routes remain unguarded.

---

### ~~GAP-27: Client App Pusher/WebSocket Hook~~ ✅ Resolved (Phase 5 Frontend + Ops Gaps Sprint)

- **Spec ref:** 5.1 (WebSocket for live queue updates)
- **Current state:** **Fixed.** `usePusherChannel` hook ported from admin to `apps/client/src/hooks/use-pusher.ts`. Wired into booking history page — subscribes to `branch-${branchId}` channel, invalidates `["history"]` queries on `QUEUE_UPDATED` event. Client `.env.example` documents `VITE_PUSHER_KEY`, `VITE_PUSHER_HOST`, `VITE_PUSHER_PORT`, `VITE_PUSHER_USE_TLS`.
- **Assigned to:** Phase 5 Frontend + Ops Gaps Sprint (done)

---

### ~~GAP-28: PWA Service Worker & Manifest~~ ✅ Resolved (Client Hardening Sprint)

- **Spec ref:** Implementation plan specifies "PWA client app"
- **Resolution:** `vite-plugin-pwa` configured in client app with Workbox runtime caching. `manifest.json` with app name, SVG icons, theme color, and `display: standalone`. App is installable on mobile home screens.

---

## 🟢 LOW — Deferred but Tracked

### ~~GAP-20: Tips Distribution Model (Pooled vs Per-Barber)~~ ✅ Resolved (Tier 2+4 Sprint)

- **Spec ref:** 2.4.3 ("Tips Distribution: per barber or pooled")
- **Resolution:** Added `TipDistribution` enum (`PER_BARBER`, `POOLED`) and `tipDistribution` field to Branch model. Commission calculation in `commissions.service.ts` now checks the branch setting — POOLED mode divides the day's tips equally among all barbers who worked that day. Admin branch settings page includes a tip distribution select.

---

### GAP-21: API Versioning

- **Spec ref:** 5.5 ("API versioning for future-proofing")
- **Current state:** API routes are `/api/queue`, `/api/transactions` — no version prefix.
- **Impact:** Low for now, but breaking changes in future will be harder without versioning.
- **Recommendation:** When making breaking changes, add `/api/v2/` prefix for new routes. For now, document as tech debt.

---

### ~~GAP-22: DB Backup Automation~~ ✅ Resolved (Tier 2+4 Sprint)

- **Spec ref:** 5.7 ("Automated daily PostgreSQL backups with point-in-time recovery")
- **Resolution:** Created `scripts/backup-db.sh` (pg_dump + gzip, 7-day retention), `scripts/restore-db.sh` (restore with confirmation), `scripts/backup-cron.example` (daily at 2AM). Documented in `docs/deployment.md` under "Database Backups" section.

---

### GAP-23: Error Tracking (Sentry)

- **Spec ref:** 5.8, Phase 2 table mentions "Error Monitoring: Sentry integration"
- **Current state:** Not in any sprint. No Sentry SDK installed.
- **Recommendation:** Add Sentry to all 3 apps (client, admin, API) as a Phase 1 tech debt item. Install `@sentry/node` for the API and `@sentry/react` for frontend apps.

---

### ~~GAP-24: Commission Structure Templates~~ ✅ RESOLVED (Admin UI & Offline POS Sprint)

- **Spec ref:** 3.4.4
- **Current state:** **Fixed.** `CONFIG_DEFAULTS` in `config.schema.ts` includes `COMMISSION_RATE_MASTER` (40%), `COMMISSION_RATE_SENIOR` (35%), `COMMISSION_RATE_JUNIOR` (30%). Admin Config panel has a "Commission Templates" section. Owner can configure per-tier default rates.
- **Assigned to:** Admin UI & Offline POS Sprint (done).

---

### ~~GAP-25: Combo/Package Duration & Buffer Calculation~~ ✅ RESOLVED

- **Spec ref:** business_logic.md §9.5 ("combo baseDuration = SUM, buffer = MAX")
- **Current state:** **Fixed.** Combo duration calculation corrected in `queue.service.ts` — SUM of durations + MAX single buffer for combos.
- **Assigned to:** Bug Fix sprint (done).

---

## Phase-Level Summary Matrix

| Impl Plan Section | Feature | Phase | Sprint Task | Status |
|---|---|---|---|---|
| 1.1.1 | Email/Password Auth | P1 | — | ✅ Built |
| 1.1.2 | OAuth (Google, Apple) | P7 | **GAP-01** | 🔶 Partial (Google OAuth done, Apple deferred) |
| 1.1.3 | Phone OTP | — | **GAP-02** | ❌ Missing |
| 1.1.4 | Profile Management | P3 | — | ✅ Built |
| 1.1.5 | Booking History | P3 | — | ✅ Built |
| 1.2.1 | Branch Discovery | P3 | — | ✅ Built |
| 1.2.2 | Branch Detail | P3 | — | ✅ Built |
| 1.2.3 | Nearest Branch | P3 | — | ✅ Built |
| 1.2.4 | Favorite Branch | — | ~~GAP-17~~ | ✅ Resolved |
| 1.3.1 | Service Selection | P3 | — | ✅ Built |
| 1.3.2 | Staff Selection | P3 | — | ✅ Built |
| 1.3.3 | Real-Time Slots | P2 | **GAP-14** | ✅ Resolved |
| 1.3.4 | Estimated Wait | P2 | — | ✅ Built |
| 1.3.5 | Booking Confirmation | P3 | — | 🔶 Partial (no push notification) |
| 1.3.6 | Reschedule/Cancel | — | ~~GAP-16~~ | ✅ Resolved |
| 1.3.7 | Grace Period | — | ~~GAP-09~~ | ✅ Resolved |
| 1.3.8 | Late → Walk-in | — | ~~GAP-09~~ | ✅ Resolved |
| 1.4.x | Loyalty System | P5 | Tasks 1-2,7 | ✅ Done (earn/redeem/expiry/tier engine + client UI) |
| 1.5.x | Reviews | P5 | Tasks 3,8 | ✅ Done (API + client UI: create, feed, moderation) |
| 1.6.x | Notifications | P3 | — | 🔶 Client-side only (no server push) |
| 2.1.1-4 | Live Queue | P2 | — | ✅ Built (admin Kanban + WebSocket) |
| 2.1.5 | Calendar View | P2 | — | ✅ Built (weekly calendar in attendance page) |
| 2.1.6 | Block-off Slots | P2 | — | ✅ Built (ShiftSchedule) |
| 2.1.7 | Overbooking Prevention | P2 | **GAP-15** | ✅ Resolved |
| 2.2.1-6 | POS Core | P4 | Tasks 2-4, 12 | ✅ Done (API + admin UI) |
| 2.2.3 | Payment Gateway | P4 | Task 5 | 🔶 Partial (webhook works, no charge creation) |
| 2.2.7 | Digital Receipt | P4 | Task 6 | ✅ Resolved (Client Hardening Sprint) |
| 2.2.8 | Offline Mode | P4 | Task 7 | ✅ Resolved (IndexedDB + sync + vite-plugin-pwa in admin) |
| 2.2.9 | Cash Reconciliation | — | ~~GAP-11~~ | ✅ Resolved |
| 2.3.1-2 | Staff Profiles | P2 | — | ✅ Built (admin CRUD + branch assignment) |
| 2.3.3 | Shift Scheduling | P2 | — | ✅ Built (admin UI) |
| 2.3.4 | Attendance | P2 | — | ✅ Built (admin UI) |
| 2.3.5 | Chair Utilization | — | ~~GAP-18~~ | ✅ Resolved (Admin UI & Offline POS Sprint) |
| 2.3.6 | Leave Management | P2 | — | ✅ Built (ShiftSchedule blocks) |
| 2.4.x | Commission/Payroll | P4 | Tasks 8-9, 14 | ✅ Done (API + admin UI) |
| 2.5.x | Inventory | P4 | Tasks 10, 15 | ✅ Done (API + admin UI) |
| 2.6.x | Branch CRM | P5 | Tasks 4-6 | ✅ Done (CRM + Campaigns + Retention) |
| 2.7.x | Branch Reporting | P6 | Task 4 | ✅ Complete |
| 2.8.1 | Operating Hours | P2 | — | ✅ Built (admin UI) |
| 2.8.1 | Holiday Calendar | — | ~~GAP-07~~ | ✅ Resolved |
| 2.8.2 | Emergency Closure | — | ~~GAP-06~~ | ✅ Resolved |
| 2.8.3 | Service Overrides | P2 | — | ✅ Built |
| 2.8.4 | Surge Pricing | P2 | **GAP-12** | ✅ Resolved (CRUD + wired in booking) |
| 3.x | Super Admin | P6 | Tasks 1-9 | ✅ Complete |
| 4.1 | Permission Matrix | P1 | — | ✅ Built |
| 4.2 | Audit Trail | P1+ | — | ✅ Built (incomplete actions) |
| 5.1 | WebSocket (Soketi) | P2 | — | ✅ Built (admin + client have real-time queue) |
| 5.2 | Notifications (Server) | P5 | ~~GAP-13~~ | ✅ Resolved (server push implemented; wired to retention, not yet to bookings/queue) |
| 5.3 | Offline Support | P4 | Task 7 | ✅ Resolved (IndexedDB + service worker via vite-plugin-pwa) |
| 5.4 | MinIO Media Upload | P5 | ~~GAP-04~~ | ✅ Resolved (S3/MinIO upload + delete endpoints) |
| 5.5 | Rate Limiting | P1 | **GAP-05** | ✅ Resolved |
| 5.6 | Security | P1 | — | ✅ Auth + rate limiting + RBAC |
| 5.7 | CI/CD | P1 | `.github/workflows/ci.yml` | ✅ Built |
| 5.8 | Error Tracking | — | **GAP-23** | ❌ Missing |
| — | Client Route Protection | P3 | ~~GAP-26~~ | ✅ Resolved |
| — | Client WebSocket/Pusher | P3 | ~~GAP-27~~ | ✅ Resolved |
| — | PWA (Service Worker) | P3 | ~~GAP-28~~ | ✅ Resolved |
| — | Phase 7 SaaS Refactor | P7 | — | ✅ Complete (multi-tenant, RBAC, generic naming, platform admin, tenant roles) |

---

## Recommended Action Plan

### Resolved (No longer needed)

| Gap | Status |
|-----|--------|
| ~~GAP-03: Account Deletion API~~ | ✅ Done |
| ~~GAP-04: MinIO Media Upload~~ | ✅ Done (Phase 5 Backend Sprint) |
| ~~GAP-05: Rate Limiting~~ | ✅ Done |
| ~~GAP-06: Emergency Closure~~ | ✅ Done (Phase 5 Frontend + Ops Gaps Sprint) |
| ~~GAP-07: Holiday Calendar~~ | ✅ Done (Phase 5 Frontend + Ops Gaps Sprint) |
| ~~GAP-08: NO_SHOW Timeout~~ | ✅ Done (node-cron, Tier 1 Sprint) |
| ~~GAP-09: Grace Period~~ | ✅ Done (Phase 5 Frontend + Ops Gaps Sprint) |
| ~~GAP-12: Surge Pricing Wire-up~~ | ✅ Done |
| ~~GAP-13: OneSignal Backend~~ | ✅ Done (Phase 5 Backend Sprint) |
| ~~GAP-14: Slot Availability API~~ | ✅ Done |
| ~~GAP-15: Overbooking Prevention~~ | ✅ Done |
| ~~GAP-19: Auto Clock-Out~~ | ✅ Done (node-cron, Tier 1 Sprint) |
| ~~GAP-25: Combo Duration Fix~~ | ✅ Done |
| ~~GAP-16: Customer Cancel/Reschedule~~ | ✅ Done (Client Hardening Sprint) |
| ~~GAP-26: Client Route Protection~~ | ✅ Done (Client Hardening Sprint) |
| ~~GAP-27: Client Pusher Hook~~ | ✅ Done (Phase 5 Frontend + Ops Gaps Sprint) |
| ~~GAP-28: PWA Service Worker~~ | ✅ Done (Client Hardening Sprint) |
| ~~GAP-18: Chair Utilization~~ | ✅ Done (Admin UI & Offline POS Sprint) |
| ~~GAP-24: Commission Templates~~ | ✅ Done (Admin UI & Offline POS Sprint) |

### Phase 4 Remaining (3rd-party integrations)

| Priority | Task/Gap | Effort | What Remains |
|----------|----------|--------|-------------|
| **P1** | Task 5: Xendit Gateway | 4h | `PaymentGatewayAdapter` interface + `XenditAdapter` class |
| ~~P2~~ | ~~Task 6: Digital Receipt UI~~ | ~~3h~~ | ✅ Done (Client Hardening Sprint) |
| ~~P3~~ | ~~Task 7: Offline POS SW~~ | ~~4h~~ | ✅ Done (Admin PWA with vite-plugin-pwa) |

### Remaining 3rd-Party Integrations

| Priority | Gap | Effort | Notes |
|----------|-----|--------|-------|
| ~~P1~~ | ~~GAP-04: MinIO Media Upload~~ | — | ✅ Done (Phase 5 Backend Sprint) |
| ~~P1~~ | ~~GAP-13: OneSignal Backend~~ | — | ✅ Done (Phase 5 Backend Sprint) |
| **P2** | GAP-01: Apple OAuth | 6h | Apple social login (Google already done) |
| **P2** | GAP-02: Phone OTP | 6h | Phone number verification via SMS provider |
| **P3** | GAP-23: Error Tracking (Sentry) | 3h | Error monitoring across all 3 apps |

### Add to Phase 6

| Gap | Add To |
|-----|--------|
| ~~GAP-06: Emergency Closure~~ | ✅ Done |
| ~~GAP-07: Holiday Calendar~~ | ✅ Done |
| ~~GAP-08: NO_SHOW Timeout~~ | ✅ Done (Tier 1 Sprint) |
| ~~GAP-09: Grace Period~~ | ✅ Done |
| ~~GAP-10: Barber Portal~~ | ✅ Done (Tier 2+4 Sprint) |
| ~~GAP-11: Cash Reconciliation~~ | ✅ Done (Tier 2+4 Sprint) |
| ~~GAP-18: Utilization Tracking~~ | ✅ Done (Admin UI & Offline POS Sprint) |
| ~~GAP-19: Auto Clock-Out~~ | ✅ Done (Tier 1 Sprint) |
| ~~GAP-20: Pooled Tips~~ | ✅ Done (Tier 2+4 Sprint) |
| ~~GAP-24: Commission Templates~~ | ✅ Done (Admin UI & Offline POS Sprint) |
