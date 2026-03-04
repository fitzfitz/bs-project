# System Audit Report (Phases 1–5)

This report documents the current state of the application as of February 2026, covering all implemented features across the API backend, client app, and admin app.

**Last updated:** Mar 3, 2026 — **Phase 7 complete (SaaS Platform Refactor).** Phase 6 complete (Super Admin & Analytics). Multi-branch analytics dashboard, user/role management, audit log viewer with anomaly detection, financial oversight (P&L), report generation with CSV export, and global platform config panel all implemented. Nightly snapshot cron and anomaly detection cron active. Phase 7 SaaS refactor: multi-tenant schema, database-driven RBAC (`requirePermission()`), generic naming (staff), platform admin, tenant role management, `@tmng/*` package namespace.

---

## 1. Visual UI Walkthrough & UX Audit

### Client App (Mobile-First PWA — `apps/client`)


| Screen                    | Status     | Notes                                                                                                    |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| **Login**                 | ✅ Working  | React Hook Form + Zod validation. Redirects to home on success.                                          |
| **Register**              | ✅ Working  | Creates customer account.                                                                                |
| **Forgot Password**       | ✅ Working  | Email form + success state. Backend returns generic message (no actual email sent).                      |
| **Home Page**             | ✅ Working  | Greeting, loyalty tier/points from API, upcoming appointment (real-time via Pusher), branch list from API. |
| **Branch Discovery**      | ✅ Working  | List + map toggle (Leaflet), search by city, favorite branch heart toggle.                               |
| **Booking Flow**          | ✅ Working  | 4 steps: service selection, barber selection, time slot picker (real-time availability API), confirm.    |
| **Profile**               | ✅ Working  | View profile, loyalty display, edit (PATCH /auth/me), delete account (DELETE /auth/me).                  |
| **Booking History**       | ✅ Working  | Upcoming/past tabs (date + status logic), cancel/reschedule actions, "View Receipt" link.                |
| **Notification Settings** | 🔶 Partial | Push toggle via OneSignal; email toggle is UI-only (no backend).                                         |
| **Legal Pages**           | ✅ Working  | Terms of Service and Privacy Policy (static content).                                                    |


### Admin App (Desktop-First — `apps/admin`)


| Screen                | Status    | Notes                                                                                                                |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| **Login**             | ✅ Working | Role-gated via database-driven RBAC (tenant roles). ProtectedRoute guard. orgSlug required.                          |
| **Dashboard**         | ✅ Working | Daily summary (revenue, tips, transaction count) with branch selector and date picker.                               |
| **Queue Management**  | ✅ Working | DnD Kanban board (dnd-kit) with droppable lanes, richer cards (time, duration, status/source badges). Assign staff, status transitions, real-time via Pusher/Soketi. |
| **POS Checkout**      | ✅ Working | Service catalog, cart, discount (flat/%), tip, payment (CASH). Branch selector. Offline fallback to IndexedDB.       |
| **Transactions**      | ✅ Working | List with filters (branch, date, status), pagination, detail modal, void action.                                     |
| **Barber Management** | ✅ Working | Table, create barber with searchable user combobox, update status, assign/unassign branch, deactivate.               |
| **Attendance**        | ✅ Working | Attendance log + shift schedule tabs with date picker, add shift modal.                                              |
| **Commissions**       | ✅ Working | Earnings table with date/staff filters.                                                                             |
| **Payroll**           | ✅ Working | Period list with status badges, generate/submit/approve/dispute/disburse actions.                                    |
| **Inventory**         | ✅ Working | Product table, stock-in/adjust dialogs, low-stock alerts.                                                            |
| **Branch Settings**   | ✅ Working | Tabs: Details (name, address, tip distribution), Operating Hours (day-of-week), Surge Pricing (rules CRUD).          |
| **Cash Drawer**       | ✅ Working | Open/close drawer, running total, entries list, end-of-day discrepancy summary.                                      |
| **Reviews Moderation**| ✅ Working | Review table with rating filter, branch selector, show/hide toggle, moderation notes. Pagination.                    |
| **Loyalty Management**| ✅ Working | Referral stats dashboard, customer loyalty lookup by user ID, manual point add/deduct, run point expiry.             |
| **Staff Portal**     | ✅ Working | Service-provider role: My Schedule (today's queue), My Commissions (earnings), My Attendance (clock-in/out history).            |
| **User Management**        | ✅ Working  | Searchable user table, role change dialog, branch assignment, activate/reactivate. RBAC: SUPER_ADMIN only for mutations. |
| **Audit Log**              | ✅ Working  | Filterable log table (branch, user, action, date range), expandable detail rows, anomaly dashboard with severity cards, resolve dialog. |
| **Analytics**              | ✅ Working  | 4 tabs: Overview (branch status cards, totals, alerts), Comparison (bar chart), Peak Hours (7x24 heatmap), Retention (cohort table). |
| **Reports**                | ✅ Working  | 5 report types (daily revenue, service popularity, staff leaderboard, customer visits, booking source), CSV export. |
| **Financial Oversight**    | ✅ Working  | P&L summary cards (revenue, costs, gross profit, margins), revenue/cost breakdown bars, void/discount cards. |
| **Platform Settings**      | ✅ Working  | Grouped config form (Loyalty, Referrals, POS & Tax) with per-key save, last-updated-by info. |


---

## 2. API Feature Coverage


| Feature Module   | Routes                                                              | Status                                                 |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| **auth**         | register, login, refresh, forgot-password, GET/PATCH/DELETE /me, favorite-branch, user search | ✅ Complete                                    |
| **health**       | GET /                                                               | ✅ Complete                                             |
| **services**     | CRUD, tier surcharges, combos, branch overrides                     | ✅ Complete                                             |
| **branches**     | CRUD, operating hours, surge rules                                  | ✅ Complete                                             |
| **staff**        | CRUD, branch assign/unassign, status update                         | ✅ Complete                                             |
| **attendance**   | clock-in/out, shift CRUD                                            | ✅ Complete                                             |
| **queue**        | list, create, status update, assign, postpone, cancel, customer-cancel, reschedule, availability, /me | ✅ Complete                                             |
| **transactions** | CRUD, pay, void, daily summary, receipt                             | ✅ Complete                                             |
| **promotions**   | promo code CRUD, validate, loyalty redemption validate              | ✅ Complete                                             |
| **commissions**  | calculate, recalculate, list earnings, barber own earnings          | ✅ Complete                                             |
| **inventory**    | product CRUD, stock-in/out/adjust, alerts, valuation                | ✅ Complete                                             |
| **cash-drawer**  | open, close, current, add entry                                     | ✅ Complete                                             |
| **payments**     | Xendit webhook                                                      | 🔶 Partial (webhook works; no charge creation adapter) |
| **payroll**      | generate, submit, approve, dispute, resolve, disburse               | ✅ Complete                                             |
| **loyalty**      | GET /me, GET /me/history, POST /redeem, POST /admin/expire, PATCH /admin/adjust, GET /:userId | ✅ Complete (Phase 5 — tier multipliers, upgrades, expiry) |
| **media**        | POST /upload (multipart, S3/MinIO)                                  | ✅ Complete (GAP-04)                                    |
| **referrals**    | GET /me/code, POST /apply, GET /me/history, GET /stats              | ✅ Complete (Phase 5)                                   |
| **reviews**      | POST, GET (public), GET /:id, PATCH /:id/moderate, DELETE /:id      | ✅ Complete (Phase 5)                                   |
| **platform**     | Auth, org CRUD, templates, features                                 | ✅ Complete (Phase 7)                                   |
| **roles**        | Tenant role CRUD, permission matrix, service assignment             | ✅ Complete (Phase 7)                                   |
| **crm**          | GET /customers, GET /customers/:id, GET /segments, POST /segments/recompute | ✅ Complete (Phase 5)                             |
| **campaigns**    | CRUD, POST /:id/send, lifecycle management                          | ✅ Complete (Phase 5)                                   |
| **retention**    | POST /trigger (manual), GET /stats, daily cron                      | ✅ Complete (Phase 5)                                   |


---

## 3. Architecture & Code Quality


| Area                     | Status              | Notes                                                                                         |
| ------------------------ | ------------------- | --------------------------------------------------------------------------------------------- |
| **API Client (Axios)**   | ✅                   | Both apps use Axios with request/response interceptors, silent token refresh, ApiError class. |
| **RBAC**                 | ✅                   | All routes guarded via database-driven RBAC. `requirePermission()` middleware replaces static `requireRole()`. LRU permission cache with 5-minute TTL. |
| **Rate Limiting**        | ✅                   | Auth-specific (login 5/min, register 3/min, refresh 10/min) + global 100/min.                 |
| **CORS**                 | ✅                   | Configured on all routes including error responses.                                           |
| **Database**             | ✅                   | Singleton Prisma + pg.Pool (Node.js). No per-request overhead. Connection error handling.     |
| **Query Caching**        | ✅                   | Global staleTime (5min) + gcTime (10min) on client QueryClient.                               |
| **Feature Architecture** | ✅                   | All queries in `features/*/api/` hooks. No inline useQuery in page files.                     |
| **Real-time**            | ✅                   | Both apps use `usePusherChannel` hook. Client subscribes on home + history pages. Admin on queue page. |
| **Route Protection**     | ✅                   | Both apps have ProtectedRoute guards. Client wraps booking, history, profile, receipt routes. |
| **PWA**                  | ✅                   | vite-plugin-pwa with Workbox, manifest, SVG icons. Installable as standalone app.             |
| **Type Safety**          | 🔶                  | Some `as any` casts remain in queue service, transaction handlers, promotion handlers.        |


---

## 4. Known Limitations (Admin App UX)

These are functional but unpolished areas in the admin app:


| Area                          | Limitation                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Commission/Payroll tables** | ✅ Resolved — `payroll.getById` now includes `barber.user` for barber names. List endpoint already had it.                           |
| **BranchSelector**            | ✅ Resolved — Always visible (even single branch), shows loading skeleton while fetching.                                            |
| **Inventory page**            | Uses first branch only; no branch selector in InventoryManager widget.                                                              |
| **POS**                       | Shows services only; no product catalog in UI. Products can be added via API.                                                       |
| **Add Barber**                | ✅ Resolved — Searchable user combobox replaces UUID pasting.                                                                       |
| **Forgot Password**           | Backend returns generic message; no actual email is sent.                                                                           |
| **Digital Receipt**           | ✅ Complete — receipt page with print CSS, linked from booking history.                                                              |
| **Scheduled Jobs**            | ✅ Complete — `node-cron` runs NO_SHOW timeout (5 min), auto clock-out (15 min), loyalty point expiry (daily 03:00 UTC), retention triggers (daily 03:05 UTC), referral expiry (daily 03:10 UTC). |
| **Seed Data**                 | ✅ Cleaned — transactional data (attendance, shifts, reviews, audit logs) removed; only reference data remains.                      |


---

## 5. E2E Flow Testing


| Use Case                      | Status | Notes                                                                                      |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| **Customer Register + Login** | ✅      | Token stored, refresh works, session persists.                                             |
| **Online Booking (Client)**   | ✅      | Select branch → services → barber → time slot → confirm. Queue entry created with booking. |
| **Walk-in Queue (Admin)**     | ✅      | Create entry via admin POS or API. Appears on Kanban board.                                |
| **Queue Status Transitions**  | ✅      | WAITING → CALLED → IN_SERVICE → COMPLETED → AT_CHECKOUT → PAID. Real-time updates on admin.  |
| **POS Checkout**              | ✅      | Service selection → discount → tip → CASH payment → transaction completed.                 |
| **Queue-to-Checkout**         | ✅      | AT_CHECKOUT auto-creates draft transaction from booking items.                             |
| **Void Transaction**          | ✅      | SUPERVISOR+ can void. Inventory reversed. Audit log created.                               |
| **Commission Calculation**    | ✅      | Auto-triggered on PAID. FLAT_PERCENTAGE, SLIDING_SCALE, BASE_PLUS_BONUS models work.       |
| **Payroll Workflow**          | ✅      | Generate → Submit → Approve → Disburse (or Dispute → Resolve path).                        |
| **Offline POS**               | ✅      | Offline transactions saved to IndexedDB, synced on reconnect.                              |
| **Overbooking Prevention**    | ✅      | 409 returned when time slot conflicts with existing booking.                               |
| **Surge Pricing**             | ✅      | Prices adjusted by surge rules matching day/hour in booking flow.                          |


---

## 6. Recently Completed Items

| Item                                     | Reference      | Sprint                    |
| ---------------------------------------- | -------------- | ------------------------- |
| ~~Client route protection (ProtectedRoute)~~ | GAP-26     | Client Hardening Sprint   |
| ~~PWA service worker + manifest~~            | GAP-28     | Client Hardening Sprint   |
| ~~Digital receipt frontend UI~~              | Phase 4 Task 6 | Client Hardening Sprint |
| ~~Customer booking cancel/reschedule~~       | GAP-16     | Client Hardening Sprint   |
| ~~Admin Queue DnD Kanban + richer cards~~    | —          | UI Layout Polish Sprint   |
| ~~Client history upcoming/past logic fix~~   | —          | UI Layout Polish Sprint   |
| ~~Branch page Scissors icon~~                | —          | UI Layout Polish Sprint   |
| ~~Home page brand gold color~~               | —          | UI Layout Polish Sprint   |
| ~~Light-only template + Dark Gold branding~~ | —          | UI Layout Polish Sprint   |
| ~~Backend: Workers → Node.js + Docker~~      | —          | Backend Migration         |
| ~~CI/CD: GitHub Actions → GHCR → VPS~~       | —          | Backend Migration         |
| ~~Auth middleware: removed per-request DB query~~ | —      | Backend Migration         |
| ~~Payroll getById barber name resolution~~       | —          | Tier 1 Polish Sprint      |
| ~~BranchSelector always visible + loading~~      | —          | Tier 1 Polish Sprint      |
| ~~Scheduled jobs: NO_SHOW timeout (node-cron)~~  | GAP-08     | Tier 1 Polish Sprint      |
| ~~Scheduled jobs: Auto clock-out at branch close~~ | GAP-19  | Tier 1 Polish Sprint      |
| ~~Seed cleanup: removed transactional data~~     | —          | Tier 1 Polish Sprint      |
| ~~LRU in-memory response cache (30s TTL)~~       | —          | API Performance Sprint    |
| ~~Pusher util: WebCrypto → Node.js crypto~~      | —          | API Performance Sprint    |
| ~~Scheduler intervals tuned (5min/15min)~~        | —          | API Performance Sprint    |
| ~~DB pool hardened (20s timeout, error handler)~~ | —          | API Performance Sprint    |
| ~~Queue card: relative date labels + position~~   | —          | API Performance Sprint    |
| ~~Queue query slimmed with select~~               | —          | API Performance Sprint    |
| ~~Added [branchId, createdAt] index~~             | —          | API Performance Sprint    |
| ~~Kanban DnD: droppable lanes + status update~~   | —          | Tier 2+4 Sprint           |
| ~~Favorite Branch (heart toggle, API, schema)~~   | GAP-17     | Tier 2+4 Sprint           |
| ~~Barber Portal (My Schedule/Commissions/Attendance)~~ | GAP-10 | Tier 2+4 Sprint           |
| ~~Cash Drawer Reconciliation (open/close/entries)~~ | GAP-11   | Tier 2+4 Sprint           |
| ~~Tips Distribution (PER_BARBER / POOLED)~~        | GAP-20     | Tier 2+4 Sprint           |
| ~~Add Barber UX: user search combobox~~            | —          | Tier 2+4 Sprint           |
| ~~DB Backup scripts (pg_dump + restore + cron)~~   | GAP-22     | Tier 2+4 Sprint           |
| ~~Type safety: 42 `as any` → proper Prisma types~~ | —         | Tier 2+4 Sprint           |
| ~~Client api.ts erasableSyntaxOnly fix~~           | —          | Tier 2+4 Sprint           |
| ~~Branches page lint errors fixed (setState in effect)~~ | —   | Tier 2+4 Sprint           |
| ~~Kanban DnD optimistic update (onDragOver + cache)~~    | —   | Kanban DnD Optimistic Update |
| ~~MinIO media upload service (S3 client + endpoint)~~    | GAP-04 | Phase 5 Backend Sprint    |
| ~~OneSignal server-side push (NotificationService)~~     | GAP-13 | Phase 5 Backend Sprint    |
| ~~Prisma schema: Referral, Segment, Campaign models~~    | Phase 5 Task 0 | Phase 5 Backend Sprint |
| ~~Loyalty Engine: tier multipliers, upgrades, expiry~~   | Phase 5 Task 1 | Phase 5 Backend Sprint |
| ~~Referral Program: code gen, apply, complete~~          | Phase 5 Task 2 | Phase 5 Backend Sprint |
| ~~Ratings & Reviews: CRUD, moderation, aggregates~~      | Phase 5 Task 3 | Phase 5 Backend Sprint |
| ~~Branch CRM: customer insights, segmentation~~          | Phase 5 Task 4 | Phase 5 Backend Sprint |
| ~~Campaign Engine: CRUD, send, lifecycle~~               | Phase 5 Task 5 | Phase 5 Backend Sprint |
| ~~Retention Triggers: at-risk nudge, expiry warning~~    | Phase 5 Task 6 | Phase 5 Backend Sprint |
| ~~TransactionService refactored to use LoyaltyService~~  | —              | Phase 5 Backend Sprint |
| ~~Referral completion hook in addPayments()~~            | —              | Phase 5 Backend Sprint |
| ~~Queue middleware: flat routing to fix customer-cancel 403~~ | —         | Bug Fix Sprint          |
| ~~Global ConfirmationDialog component (danger/warning/info)~~ | —        | Bug Fix Sprint          |
| ~~Cancel booking confirmation UX~~                            | —        | Bug Fix Sprint          |
| ~~Client Pusher hook: home + history real-time~~              | GAP-27   | Phase 5 Completion      |
| ~~Client Loyalty UI (dashboard, tiers, referrals, history)~~  | Phase 5 Task 7 | Phase 5 Completion |
| ~~Client Reviews UI (feed, form, star rating, photo upload)~~ | Phase 5 Task 8 | Phase 5 Completion |
| ~~Admin Reviews Moderation page (filter, show/hide, delete)~~ | —        | Phase 5 Completion      |
| ~~Admin Loyalty Management page (lookup, adjust, stats)~~     | —        | Phase 5 Completion      |
| ~~Referral expiry cron (30d PENDING → EXPIRED)~~              | Phase 5 Task 2 | Phase 5 Completion |
| ~~Reviews API: includeHidden query param for admin~~          | —        | Phase 5 Completion      |
| ~~Phase 6 Task 0: Schema additions (BranchDailySnapshot, AnomalyFlag, PlatformConfig)~~ | Phase 6 Task 0 | Phase 6 Sprint |
| ~~Phase 6 Task 1: Super Admin scaffold (sidebar, routes, page shells)~~ | Phase 6 Task 1 | Phase 6 Sprint |
| ~~Phase 6 Task 2: Global Dashboard + nightly snapshot cron~~ | Phase 6 Task 2 | Phase 6 Sprint |
| ~~Phase 6 Task 3: Analytics Engine (comparison, heatmap, retention, forecast)~~ | Phase 6 Task 3 | Phase 6 Sprint |
| ~~Phase 6 Task 4: Reports + CSV export (5 report types)~~ | Phase 6 Task 4 | Phase 6 Sprint |
| ~~Phase 6 Task 5: User & Role Management API + UI~~ | Phase 6 Task 5 | Phase 6 Sprint |
| ~~Phase 6 Task 6: Audit Log + Anomaly Detection~~ | Phase 6 Task 6 | Phase 6 Sprint |
| ~~Phase 6 Task 7: Financial Oversight (P&L, void/discount audit)~~ | Phase 6 Task 7 | Phase 6 Sprint |
| ~~Phase 6 Task 9: Global Config (PlatformConfig CRUD + caching)~~ | Phase 6 Task 9 | Phase 6 Sprint |
| ~~Type fixes: reports customer query, users loyaltyAccount select, deactivate route~~ | — | Phase 6 Sprint |
| ~~Phase 7: Multi-tenant schema (organizationId on 35+ tables)~~ | Phase 7A | Phase 7 Sprint |
| ~~Phase 7: RBAC middleware (requirePermission replaces requireRole)~~ | Phase 7B-1 | Phase 7 Sprint |
| ~~Phase 7: 26 feature files refactored (generic naming + org-scoping)~~ | Phase 7B-2 | Phase 7 Sprint |
| ~~Phase 7: Auth refactor (orgSlug login, new JWT claims, Google OAuth)~~ | Phase 7B-3 | Phase 7 Sprint |
| ~~Phase 7: Platform admin endpoints (org CRUD, templates, features)~~ | Phase 7B-4 | Phase 7 Sprint |
| ~~Phase 7: Tenant role management (CRUD, permission matrix, service assignment)~~ | Phase 7B-5 | Phase 7 Sprint |
| ~~Phase 7: Seed data rewrite (25 features, 4 templates, barbershop tenant)~~ | Phase 7C | Phase 7 Sprint |
| ~~Phase 7: Frontend type updates (admin + client)~~ | Phase 7D | Phase 7 Sprint |
| ~~Phase 7: Package rename (@tmng/* namespace)~~ | Phase 7E | Phase 7 Sprint |
| ~~Phase 7: Documentation update~~ | Phase 7F | Phase 7 Sprint |


## 9. Phase 7: SaaS Platform Refactor

| Item | Status | Sprint |
|------|--------|--------|
| Multi-tenant schema (organizationId on 35+ tables) | ✅ Complete | Phase 7A |
| RBAC middleware (`requirePermission()` replaces `requireRole()`) | ✅ Complete | Phase 7B-1 |
| 26 feature files refactored for generic naming + org-scoping | ✅ Complete | Phase 7B-2 |
| Auth refactor (orgSlug login, new JWT claims, Google OAuth) | ✅ Complete | Phase 7B-3 |
| Platform admin endpoints (org CRUD, templates, features) | ✅ Complete | Phase 7B-4 |
| Tenant role management (CRUD, permission matrix, service assignment) | ✅ Complete | Phase 7B-5 |
| Seed data rewrite (25 features, 4 templates, barbershop tenant) | ✅ Complete | Phase 7C |
| Frontend type updates (admin + client) | ✅ Complete | Phase 7D |
| Package rename (`@tmng/*` namespace) | ✅ Complete | Phase 7E |
| Documentation update | ✅ Complete | Phase 7F |

---

## 10. Remaining High-Priority Items

| Priority | Item                                     | Reference      |
| -------- | ---------------------------------------- | -------------- |
| **P1**   | Xendit payment adapter (charge creation) | Phase 4 Task 5 |


## 11. Resolved Items (Phase 6 Completion)

| Item                                     | Reference      | Sprint                    |
| ---------------------------------------- | -------------- | ------------------------- |
| ~~Phase 6 Task 0: Schema additions (BranchDailySnapshot, AnomalyFlag, PlatformConfig)~~ | Phase 6 Task 0 | Phase 6 Sprint |
| ~~Phase 6 Task 1: Super Admin scaffold (sidebar, routes, page shells)~~ | Phase 6 Task 1 | Phase 6 Sprint |
| ~~Phase 6 Task 2: Global Dashboard + nightly snapshot cron~~ | Phase 6 Task 2 | Phase 6 Sprint |
| ~~Phase 6 Task 3: Analytics Engine (comparison, heatmap, retention, forecast)~~ | Phase 6 Task 3 | Phase 6 Sprint |
| ~~Phase 6 Task 4: Reports + CSV export (5 report types)~~ | Phase 6 Task 4 | Phase 6 Sprint |
| ~~Phase 6 Task 5: User & Role Management API + UI~~ | Phase 6 Task 5 | Phase 6 Sprint |
| ~~Phase 6 Task 6: Audit Log + Anomaly Detection~~ | Phase 6 Task 6 | Phase 6 Sprint |
| ~~Phase 6 Task 7: Financial Oversight (P&L, void/discount audit)~~ | Phase 6 Task 7 | Phase 6 Sprint |
| ~~Phase 6 Task 9: Global Config (PlatformConfig CRUD + caching)~~ | Phase 6 Task 9 | Phase 6 Sprint |
| ~~Type fixes: reports customer query, users loyaltyAccount select, deactivate route~~ | — | Phase 6 Sprint |
