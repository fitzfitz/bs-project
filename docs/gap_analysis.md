# Gap Analysis

> **Last updated:** Apr 6, 2026 — Resolved GAP-38 (Resend email migration). Transactional emails migrated from OneSignal to Resend SDK with database-driven user email resolution.

---

## Open Gaps

### GAP-33: Promotions / Promo Code Admin UI (MEDIUM)

- **Spec ref:** 2.6.3 (Promo Code & Campaign Management)
- **Current state:** API `features/promotions/` has full CRUD (create, update, delete, validate promo codes). Campaigns reference `promoCodeId` and POS wire format accepts `promoCode`, but **no admin page** exists to create or manage promo codes.
- **Impact:** Admins cannot create/edit/delete promo codes without direct API calls.
- **Effort:** 4h (admin page with CRUD table + create/edit dialog)

### GAP-34: Tenant Role Management Admin UI (MEDIUM)

- **Spec ref:** 3.5.2 (Role Assignment & Permission Matrix Management)
- **Current state:** API `features/roles/` has full tenant role CRUD and permission matrix editor. However, **no admin page** exists for role management. The user management page derives role options only from roles already assigned to loaded users — custom roles with zero assigned users are invisible.
- **Impact:** RBAC is fully functional at API level but cannot be managed through the admin dashboard.
- **Effort:** 6h (admin page with role list, create/edit dialog, permission matrix grid)

### GAP-35: Split Payment in POS UI (LOW)

- **Spec ref:** 2.2.5 (Split Payment Support)
- **Current state:** API `addPayments` endpoint accepts an array of payment objects. POS checkout UI **always sends a single payment** with the full transaction amount. No UI exists for splitting across multiple methods.
- **Impact:** Cashiers cannot split a transaction across e.g. CASH + QRIS.
- **Effort:** 4h (multi-payment form with remaining-balance tracker)

### GAP-36: Service Add-Ons Not Fully Implemented (LOW)

- **Spec ref:** business_logic.md §9.3 (Add-Ons), implementation_plan.md §3.3.4
- **Current state:** `ServiceType` enum includes `ADD_ON` and POS wire format has `isAddOn` field, but the UI hard-codes `isAddOn: false`. No dedicated add-on management UI exists. No add-on selection in booking or POS flows.
- **Impact:** Add-ons exist at schema/enum level but are not usable by staff or customers.
- **Effort:** 8h (add-on CRUD in service catalog, add-on picker in booking + POS)

### GAP-37: Forgot Password Email Not Implemented (LOW)

- **Spec ref:** 1.1 (Authentication)
- **Current state:** `auth.service.ts` `forgotPassword()` is a stub that always returns a generic success message without sending any email. Both `nodemailer` (reports) and `Resend` (transactional) infrastructure now exist.
- **Impact:** Users cannot actually reset their password via email.
- **Effort:** 3h (generate reset token, send email via Resend, add reset endpoint)

### GAP-21: API Versioning (TECH DEBT — LOW)

- **Spec ref:** 5.5
- **Current state:** `/api/v2` mount point scaffolded with separate OpenAPI docs and `X-API-Version` header. No routes moved to v2 yet.
- **Impact:** Low for now. When breaking changes are needed, v2 routes are ready.
- **Recommendation:** Use when making breaking changes. No action needed until then.

---

## Documentation-Level Gaps (Fixed in this restructure)

| Gap | Status |
|-----|--------|
| `service_architecture.md` scheduler table missing demand forecast + churn crons | Fixed in `platform_overview.md` |
| `monorepo-standards.mdc` says "46 models" (actual: 56) | Fixed in cursor rules update |
| `implementation_plan.md` header outdated (says Sprint 9, Sprint 10 complete) | Archived; info moved to `features.md` |
| Admin OpenSpec specs missing for campaigns, notifications, retention, waitlist | Documented in `features.md` feature catalog |
| Platform admin is API-only by design but undocumented | Documented in `platform_overview.md` |

---

## Descoped Items

| Item | Reason |
|------|--------|
| Phone OTP (GAP-02) | Requires third-party SMS provider account and ongoing costs. Not needed for MVP. |
| Apple Sign-In | `APPLE` removed from `AuthProvider` enum. Not worth the developer account cost. |
| Error Tracking / Sentry (GAP-23) | Replaced by pino structured logging + request correlation IDs. |

---

## Resolved Gaps Summary

All 32 originally tracked gaps have been resolved across Phases 1–7 and Sprints 1–10.

| GAP | Description | Resolution |
|-----|-------------|------------|
| GAP-01 | Google OAuth | Server-side JWKS via `google-auth-library` |
| GAP-03 | Account Deletion API | `DELETE /auth/me` with anonymization |
| GAP-04 | MinIO Media Upload | S3-compatible upload + delete endpoints |
| GAP-05 | Rate Limiting | Auth-specific + global rate limits |
| GAP-06 | Emergency Closure | Schema + API + admin UI + client badge |
| GAP-07 | Holiday Calendar | `BranchHoliday` model + CRUD + slot integration |
| GAP-08 | NO_SHOW Timeout | node-cron scheduled job (5-min interval) |
| GAP-09 | Grace Period Auto-Release | Cron releases late online bookings after 10 min |
| GAP-10 | Barber Portal | Role-gated admin routes for staff self-service |
| GAP-11 | Cash Drawer Reconciliation | Full API + admin UI with open/close/entries |
| GAP-12 | Surge Pricing | Wired into queue.service booking flow |
| GAP-13 | OneSignal Backend | `NotificationService` with push/WhatsApp/SMS |
| GAP-14 | Real-Time Slot Availability | `GET /queue/availability` + client time picker |
| GAP-15 | Overbooking Prevention | Conflict detection in `createEntry()` |
| GAP-16 | Booking Cancel/Reschedule | Customer-facing cancel + reschedule endpoints |
| GAP-17 | Favorite Branch | Added then removed in Phase 7 SaaS refactor |
| GAP-18 | Chair Utilization | `GET /analytics/utilization` + admin tab |
| GAP-19 | Auto Clock-Out | Cron at branch closing time |
| GAP-20 | Tips Distribution | PER_BARBER / POOLED config on Branch model |
| GAP-22 | DB Backup Automation | pg_dump scripts + cron + docs |
| GAP-24 | Commission Templates | Config-driven per-tier default rates |
| GAP-25 | Combo Duration Fix | SUM durations + MAX buffer for combos |
| GAP-26 | Client Route Protection | `ProtectedRoute` component in client app |
| GAP-27 | Client Pusher Hook | `usePusherChannel` ported to client |
| GAP-28 | PWA Service Worker | vite-plugin-pwa with Workbox |
| GAP-29 | Server Push for Core Flows | Booking, CALLED/COMPLETED, reminders |
| GAP-30 | Google OAuth JWKS | `google-auth-library` token verification |
| GAP-31 | Referral Expiry | `expiresAt` field + config-driven + scheduler |
| GAP-32 | Stock Movement History | `GET /inventory/branches/:branchId/movements` |
| INFRA-PATCH | OneSignal & Pusher Synchronization | Fixed `.dev.vars` vs `.env` API loading isolation. Patched React Strict mode fast-refresh disconnects in `usePusherChannel`, and implemented foreground OneSignal listeners to force layout updates. |
| GAP-38 | Resend Email Migration | Migrated transactional emails from OneSignal to Resend SDK. Implemented DB lookup for user emails in background jobs. |

---

## Phase Completion Matrix

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Foundation (auth, schema, RBAC, API skeleton) | Complete |
| Phase 2 | Branch Operations (queue, staff, attendance, scheduling) | Complete |
| Phase 3 | Client Application (booking, branch discovery, PWA) | Complete |
| Phase 4 | Financial & Workforce (POS, commissions, payroll, inventory) | Complete |
| Phase 5 | Loyalty & Engagement (loyalty, referrals, reviews, CRM, campaigns) | Complete |
| Phase 6 | Super Admin & Analytics (dashboard, analytics, reports, audit, finance) | Complete |
| Phase 7 | SaaS Platform Refactor (multi-tenant, RBAC, generic naming) | Complete |
| Sprint 1–4 | Production readiness, admin UI gaps, client experience, admin polish | Complete |
| Sprint 5–6 | Cleanup, type safety, deployment (Dockerfiles, CI/CD) | Complete |
| Sprint 7–8 | Deep tests, WhatsApp/SMS providers, production hardening | Complete |
| Sprint 9 | i18n (en/id), advanced reporting (PDF/SMTP), customer self-service | Complete |
| Sprint 10 | Multi-currency, demand forecasting, smart scheduling, churn prediction | Complete |
| Admin Redesign | Design system, shell redesign, page migration, polish & docs (12 sprints) | Complete |

---

## Current Metrics

| Metric | Value |
|--------|-------|
| API Feature Modules | 31 |
| API Endpoints | 200+ |
| Admin Pages | 29 |
| Client Pages | 16 |
| Prisma Models | 56 |
| Vitest Tests | 951 (553 API / 257 admin / 141 client) |
| E2E Playwright Specs | 9 (6 admin + 3 client) |
| Resolved Gaps | 32 of 32 (original) |
| Open Gaps | 4 (GAP-33 to GAP-37) + 1 tech debt (GAP-21) |

## Admin UI Redesign (Mar 28, 2026)

The admin dashboard underwent a full 12-sprint redesign across 4 phases:

| Phase | Sprints | Deliverables |
|-------|---------|-------------|
| 1 — Foundation | 1.1–1.3 | Design system tokens, 12 Shadcn primitives, 7 composite components, nav-config, shared utilities |
| 2 — Shell | 2.1–2.4 | Grouped collapsible sidebar, topbar (breadcrumbs, profile dropdown, command palette, notification bell) |
| 3 — Migration | 3.1–3.3 | All 27 admin pages + 3 barber portal pages migrated to design system |
| 4 — Polish | 4.1–4.2 | Accessibility (ARIA, focus, keyboard nav), `design-system.mdc` + `style-discipline.mdc` Cursor rules |

Test coverage increased from 167 → 257 admin tests (33 files). See `docs/admin-redesign-sprint.md` for full details.

### Client test coverage expansion (Mar 28, 2026)

Added standalone tests for shared client code previously only tested indirectly:
- `src/lib/__tests__/utils.test.ts` — `cn` and `formatCurrency` (11 tests)
- `src/components/__tests__/ui-components.test.tsx` — Button, Input, Label, ConfirmationDialog, ConfirmationProvider (20 tests)

Client tests increased from 110 → 141 (15 files).
