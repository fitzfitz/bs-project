# TMNG SaaS Platform — Next Phase Plan

> **Created:** Mar 9, 2026 | **Updated:** Mar 24, 2026
> **Context:** All 7 phases and Sprints 1–10 complete. 30 GAPs resolved, 200+ endpoints, 830 Vitest tests, E2E Playwright coverage, staging CI/CD operational with client+admin Docker builds. Sprint 10 delivered multi-currency support (dynamic org currency replacing hardcoded IDR), demand forecasting (time-series decomposition), smart scheduling suggestions (demand-capacity matching), and churn prediction (weighted RFM scoring). This document captures the remaining work for the next development cycle.

---

## Current State Summary

| Metric | Value |
|--------|-------|
| API Feature Modules | 30 |
| API Endpoints | 200+ |
| Admin Pages | 29 |
| Client Pages | 16 |
| Prisma Models | ~56 |
| Vitest Tests Passing | 830 (553 API + 167 admin + 110 client) |
| Curl Tests Passing | 279/282 (3 skipped — review creation needs prior transaction) |
| Resolved Gaps | 30 of 30 (all closed) |
| Phases 1–7 | 100% Complete |
| Sprints 1–10 | 100% Complete |
| Staging CI/CD | Docker build+push to GHCR (API + client + admin) + SSH deploy via GitHub Actions |
| E2E Playwright | 6 admin + 3 client spec files; CI integration |

---

## Remaining Work

### ~~Sprint 5: Cleanup & Housekeeping~~ ✅ COMPLETE

All 5 items delivered. API ESLint now enforced, `.dev.vars.example` fixed, client legal page links added, email notification preferences persisted via `PATCH /auth/me/notification-preferences`, emergency closure push notifications wired via `NotificationService`. Test count increased from 688 to 703.

---

### ~~Sprint 6: Type Safety & Deployment~~ ✅ COMPLETE

All 5 items delivered. Zero `as any` casts in API source (40 removed across 10 files with proper Prisma `WhereInput`/enum types). Client + Admin Dockerfiles created (multi-stage Node build + Nginx serve with SPA fallback). API versioning scaffolded (`/api/v2` mount with separate OpenAPI docs, `X-API-Version` response header). Bulk payroll operations (`POST /payroll/bulk-approve`, `POST /payroll/bulk-disburse`) with all-or-nothing `$transaction`, admin UI multi-select + bulk action toolbar. CI pipeline updated with client + admin Docker image builds. Test count increased from 703 to 712.

---

### ~~Sprint 7: Features & Test Coverage~~ ✅ COMPLETE

Both items delivered. Deep service-level unit tests added for `transactions.service.ts` (16 tests: tax calc, discount rules, audit logging, payment flow, void/refund, loyalty reversal, daily summary, pagination, receipt), `commissions.service.ts` (18 tests: 3 commission models, tip distribution, exclusions, edge cases, trigger/recalculate), `queue.service.ts` (13 tests: entry creation, staff overlap, status transitions, timestamps, assign/postpone/cancel/reschedule, availability with holidays, user entries). WhatsApp notification provider implemented via Twilio adapter in `NotificationService` with graceful degradation, 2 new Prisma models (`NotificationChannelConfig`, `NotificationPreference`), admin channel config endpoints (`GET /channels`, `PUT /channels/:type`), client preference endpoints (`GET /preferences`, `PUT /preferences`), full RBAC gating. Test count increased from 712 to 771.

### ~~Sprint 8: Production Hardening + SMS Notification Provider~~ ✅ COMPLETE

Both HIGH-priority future opportunities delivered. **Production Hardening:** Replaced all `console.log/error` with pino structured logging (JSON in production, pino-pretty in development). Added `X-Request-Id` correlation middleware (reads from client header or generates UUID, propagated through all log lines). Enhanced `GET /api/health` to return uptime, memory stats (rss/heapUsed/heapTotal in MB), DB pool stats (totalCount/idleCount/waitingCount), and API version. DB pool tuning: configurable `DB_POOL_MAX` env var, explicit warmup query on pool creation. **SMS Notification Provider:** Added `sendSms()` to `NotificationService` interface using Twilio Messages API (plain text Body, E.164 From/To, same account as WhatsApp). Added `smsEnabled` to `NotificationChannelConfig` and `smsOptOut` to `NotificationPreference` Prisma models. Updated notification schemas, handlers, and all test mocks. New env vars: `TWILIO_SMS_FROM`, `LOG_LEVEL`, `DB_POOL_MAX`. API test count increased from 503 to 510.

### ~~Sprint 9: i18n + Advanced Reporting + Customer Self-Service~~ ✅ COMPLETE

Three MEDIUM-priority items delivered. **Multi-language (i18n):** Frontend-only `react-i18next` for admin and client with English (`en`) and Indonesian (`id`), namespace JSON files, language switcher in admin sidebar and client profile. **Advanced reporting:** PDF export via `pdfkit`, transactional email via `nodemailer` (SMTP), `ReportSchedule` model (`ReportFrequency`: DAILY/WEEKLY/MONTHLY) with hourly cron processor, `SavedReportTemplate` model, admin Reports UI tabs (Generate / Schedules / Templates). **Customer self-service:** Optional online prepayment (Xendit) when `PREPAYMENT_ENABLED`; org config for deposit %, cancellation policy hours, penalty %, waitlist caps; `QueueEntry` fields `prepaidAmount`, `prepaymentReference`, `refundAmount`; `WaitlistEntry` model + waitlist API; cancellation penalty logic for prepaid bookings; admin config “Customer Self-Service” section. New API deps: `pdfkit`, `@types/pdfkit`, `nodemailer`, `@types/nodemailer`. New admin/client deps: `react-i18next`, `i18next`, `i18next-browser-languagedetector`. New env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. New crons: report schedule processor (hourly), waitlist entry expiry (every 5 minutes). Vitest total increased to 822.

---

### ~~Sprint 10: Multi-Currency + AI/ML Features~~ ✅ COMPLETE

Four items delivered across three sub-sprints. **Multi-Currency (10A):** Dynamic org currency propagated through `GET /auth/me` session, loyalty config-driven rates (`POINTS_EARN_RATE`/`POINTS_REDEEM_RATE`), Xendit adapter `currency` param, PDF/CSV currency formatting, shared `formatCurrency()` utility in admin + client replacing ~20 hardcoded IDR files, `OrgCurrency` in session stores. **Demand Forecasting (10B):** `DemandForecast` Prisma model, `ForecastService` with time-series decomposition (7-day MA, seasonal indices, linear regression trend, confidence bands, holiday dampening), `GET /analytics/demand-forecast` + `POST /analytics/demand-forecast/compute`, nightly cron at 02:15 UTC, admin Forecast tab with MAPE accuracy. **Smart Scheduling (10B):** `ScheduleSuggestion` model + `SuggestionStatus` enum, `SchedulingService` demand-capacity matching, accept/reject workflow with auto `ShiftSchedule` creation, admin Smart Schedule tab. **Churn Prediction (10C):** `ChurnScore` model + `ChurnRiskLevel` enum, `ChurnService` weighted RFM scoring (recency/frequency/monetary/engagement), `GET /analytics/churn-scores` + `POST /analytics/churn-scores/compute` + `GET /analytics/churn-scores/:customerId`, weekly cron Monday 04:00 UTC, admin Churn Risk tab with risk filtering. New API dep: `simple-statistics`. Vitest total: 830 (553 API + 167 admin + 110 client).

---

## Quick Reference: What's Working Now

- 30 API feature modules with 200+ endpoints
- Full booking flow (branch → services → barber → time → confirm) with push notifications
- POS with products, services, 4 payment methods, offline fallback + PWA
- Xendit payment gateway: charge creation + webhook callback + saved payment methods
- Commission/payroll with 3 calculation models, approval workflow, and config-driven template rates
- Inventory with stock-in/out/adjust + product CRUD + stock movement history
- Service catalog management (CRUD, tier surcharges, combos, branch overrides)
- Campaign management (CRUD, send, status lifecycle, branch filtering)
- CRM customer insights (per-branch customer table, segmentation, recompute)
- Notification management admin UI (org-wide list, stats, test-send)
- Retention management admin UI (stats, manual trigger with confirmation)
- Real-time queue (Pusher/Soketi) with push notifications on CALLED/COMPLETED
- Loyalty engine with tiers, referrals (with configurable expiry), point expiry
- Analytics with 6 dashboards + revenue trend chart + payment method donut + transaction volume bars
- Google OAuth with server-side JWKS verification (`google-auth-library`)
- Database-driven RBAC with 25 features × CRUD permissions
- Permission-based sidebar and route guards
- PWA with service worker caching for both admin and client apps
- Audit logging with anomaly detection
- In-app notification inbox (API + client page) with unread count badge
- Saved payment methods (API + client page) with Xendit tokenization
- Staff/branch photo upload via MinIO with reusable ImageUpload component
- Appointment reminder cron (30 min before scheduled time)
- Staging CI/CD: Docker build+push to GHCR + SSH deploy
- E2E Playwright tests: 6 admin + 3 client spec files with CI integration
- API ESLint enforced (ESLint 9 flat config, zero warnings)
- Email notification preferences backend (`PATCH /auth/me/notification-preferences`)
- Emergency closure push notifications via NotificationService + in-app Notification records
- Client legal page links (Terms of Service, Privacy Policy) from profile page
- WhatsApp notification provider (Twilio adapter, admin channel config, client preference toggle)
- SMS notification provider (Twilio adapter, channel config smsEnabled, preference smsOptOut)
- Deep service-level tests for transactions, commissions, and queue services
- Structured logging (pino), request correlation IDs, enhanced health endpoint, DB pool tuning
- Multi-currency support (dynamic org currency, formatCurrency utility, Xendit/report/loyalty integration)
- Demand forecasting (time-series decomposition, 14-day forecasts, holiday dampening, nightly cron, MAPE accuracy)
- Smart scheduling suggestions (demand-capacity matching, accept/reject workflow, auto shift creation)
- Churn prediction (weighted RFM scoring, 4 risk tiers, weekly cron, customer-level detail)
- 830 Vitest tests passing (553 API + 167 admin + 110 client)
- 279 curl integration tests passing
- i18n (en/id) on admin + client; PDF reports + scheduled email reports + saved templates; optional prepayment, cancellation penalties (prepaid only), waitlist

### What's NOT Working / Missing

- No current gaps — all sprint items complete through Sprint 9

---

## What's Next / Future Opportunities

The platform is feature-complete for all originally scoped requirements plus Sprint 9 MEDIUM items. Remaining directions are LOW-priority expansion:

| Priority | Opportunity | Description |
|----------|-------------|-------------|
| ~~HIGH~~ | ~~Production Hardening~~ | ✅ Complete (Sprint 8) — pino structured logging, request correlation IDs, enhanced health endpoint, DB pool tuning |
| ~~HIGH~~ | ~~SMS Notification Provider~~ | ✅ Complete (Sprint 8) — Twilio SMS adapter added to `NotificationService`, schema + handler + preference updates |
| ~~MEDIUM~~ | ~~Multi-Language (i18n)~~ | ✅ Complete (Sprint 9) — `react-i18next`, en/id namespaces, switchers in admin sidebar + client profile |
| ~~MEDIUM~~ | ~~Advanced Reporting~~ | ✅ Complete (Sprint 9) — PDF (`pdfkit`), SMTP (`nodemailer`), `ReportSchedule` / `SavedReportTemplate`, admin tabs |
| ~~MEDIUM~~ | ~~Customer Self-Service~~ | ✅ Complete (Sprint 9) — optional Xendit prepayment, cancellation policy + penalties, waitlist + expiry cron |
| ~~LOW~~ | ~~Multi-Currency Support~~ | ✅ Complete (Sprint 10A) — dynamic org currency, shared `formatCurrency`, Xendit/report/loyalty integration |
| ~~LOW~~ | ~~AI/ML Features~~ | ✅ Complete (Sprint 10B/C) — demand forecasting, smart scheduling, churn prediction |

### What's Next

All originally scoped features and LOW-priority expansion items are now complete. PWA-only strategy — no native app wrapper planned. Future work could include: advanced ML models (Python microservice), A/B testing framework, multi-org platform admin, or white-label theming. No blocking gaps remain.

---

## Completed Sprint History

All prior sprints are fully resolved. See [audit_report.md](audit_report.md) for the detailed completion log covering:

- **Phases 1–7** — Foundation, Branch Operations, Client App, Financial & Workforce, Loyalty & Engagement, Super Admin & Analytics, SaaS Platform Refactor
- **Sprint 1** — Production Readiness (Google OAuth JWKS, Xendit charge creation, staging CI/CD, TypeScript strict mode)
- **Sprint 5** — Cleanup & Housekeeping (API ESLint, `.dev.vars.example` fix, legal page links, email notification preferences, emergency closure push notifications)
- **Sprint 6** — Type Safety & Deployment (as-any cleanup, client/admin Dockerfiles, /api/v2 versioning, bulk payroll operations)
- **Sprint 7** — Features & Test Coverage (deep service tests for transactions/commissions/queue, WhatsApp notification provider via Twilio)
- **Sprint 8** — Production Hardening + SMS (pino structured logging, request correlation IDs, enhanced health endpoint, DB pool tuning, SMS notification provider via Twilio)
- **Sprint 9** — i18n (en/id, react-i18next), Advanced Reporting (PDF, SMTP, schedules, templates), Customer Self-Service (prepayment, cancellation penalties, waitlist)
- **Sprint 2** — Admin UI Gaps (Service Catalog, Product Management, Campaign Management, CRM, stock movement history)
- **Sprint 3** — Client Experience (push notifications for booking/queue/reminders, notification inbox, saved payment methods)
- **Sprint 4** — Admin Polish & Testing (notification/retention admin UIs, commission template wiring, referral expiry, photo upload, dashboard charts, E2E Playwright)
- **Sprint 10** — Multi-Currency + AI/ML (dynamic org currency, demand forecasting, smart scheduling, churn prediction, 3 new Prisma models, 3 new admin tabs, 2 new crons)
