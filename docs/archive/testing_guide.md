# Testing Guide

This document covers how to run all tests for the TMNG SaaS Platform, including API curl tests, Playwright E2E tests, and the unified test runner.

---

## Quick Start

```bash
# Run ALL tests (API + Client E2E + Admin E2E)
bash scripts/run-tests.sh all

# Run only API curl tests
bash scripts/run-tests.sh api

# Run only Client Playwright tests
bash scripts/run-tests.sh client

# Run only Admin Playwright tests
bash scripts/run-tests.sh admin
```

---

## Prerequisites

Before running tests, ensure the following are running:

| Service | Command | URL |
|---------|---------|-----|
| API Server | `pnpm --filter @tmng/saas-api dev` | http://localhost:8787 |
| Client App | `pnpm --filter @tmng/barber-client dev` | http://localhost:5174 |
| Admin App | `pnpm --filter @tmng/barber-admin dev` | http://localhost:5175 |
| PostgreSQL | Docker or remote | See `.dev.vars` |

**Database setup:**
```bash
# Run migrations
pnpm --filter @tmng/saas-api db:push

# Seed test data
pnpm --filter @tmng/saas-api db:seed
```

**Install Playwright browsers (first time only):**
```bash
cd apps/client && npx playwright install chromium
cd apps/admin && npx playwright install chromium
```

---

## Test Suites

### 1. API Curl Tests (`docs/curl_tests.sh`)

Comprehensive bash script that tests all API endpoints sequentially. The script is self-contained — it registers test users, creates data, and validates responses.

**How to run:**
```bash
bash docs/curl_tests.sh
```

**Sections:**

| # | Section | Tests | Description |
|---|---------|-------|-------------|
| 0 | Health Check | 1 | API availability |
| 1 | Authentication | 11 | Register, login, refresh, profile, negative cases |
| 2 | Branches | 11 | CRUD, operating hours, surge rules |
| 3 | Services | 13 | Catalog, combos, surcharges, overrides |
| 4 | Barbers | 10 | Profiles, branch assignment, status |
| 5 | Attendance | 8 | Clock in/out, shifts |
| 6 | Queue & Booking | 12 | Walk-in, online booking, status transitions |
| 7 | Transactions | 10 | POS, payments, void, receipt |
| 8 | Promotions | 7 | Promo codes, validation |
| 9 | RBAC | 5 | Access control negative tests |
| 10 | E2E Customer Journey | 10 | Full register → book → pay → receipt flow |
| 11 | Loyalty | 6 | Points, history, admin adjustment, expiry |
| 12 | Referrals | 5 | Code generation, apply, history, stats |
| 13 | Reviews | 8 | Create, list, filter, moderate |
| 14 | Commissions | 5 | Calculate, recalculate, earnings |
| 15 | Payroll | 8 | Generate, submit, approve, dispute, resolve |
| 16 | Inventory | 13 | Products, stock in/out, adjust, alerts, valuation |
| 17 | Cash Drawer | 6 | Open, entries, close |
| 18 | CRM | 4 | Customers, segments, recompute |
| 19 | Campaigns | 4 | Create, list, update, send |
| 20 | Retention | 2 | Trigger, stats |
| 21 | Media | 1 | File upload (requires S3) |
| 22 | E2E Loyalty | 6 | Earn points → verify balance |
| 23 | E2E Referral | 5 | Refer → register → transact → bonus |
| 24 | E2E Commission/Payroll | 6 | Transaction → commission → payroll lifecycle |
| 25 | E2E Cash Drawer | 5 | Open → sales → refund → close → verify |
| 26 | E2E Walk-in to Review | 6 | Walk-in → PAID → review → verify rating |
| 27 | RBAC Extended | 9 | Extended negative permission tests |
| 28 | User Management (SUPER_ADMIN) | 10 | List, search, role change, deactivate/reactivate, branch assign |
| 29 | Audit Log & Anomalies | 5 | List logs, filter by action, anomalies, stats, resolve |
| 30 | Analytics (SUPER_ADMIN) | 7 | Global dashboard, comparison, heatmap, retention, forecast, snapshot compute |
| 31 | Reports (SUPER_ADMIN) | 6 | 5 report types + CSV export |
| 32 | Financial Oversight | 5 | Consolidated P&L, branch P&L, void/discount audit, payroll oversight, tax summary |
| 33 | Platform Config | 4 | List config, update TAX_RATE, update POINTS_EARN_RATE, verify |
| 34 | Phase 6 RBAC Negative | 7 | Customer/Manager cannot access Phase 6 endpoints |

**Total: 237 test cases**

**Important notes:**
- Phase 6 tests (sections 28–34) require a tenant Owner or Manager. The seed creates `owner@barber.com` / `Password123!` (Owner role) and `manager@barber.com` / `Password123!` (Manager role). For platform-level tests, use `admin@tmng.dev` / `PlatformAdmin123!` (PLATFORM_ADMIN).
- The media upload test (21) requires MinIO/S3 to be configured.
- The script uses `jq` if available, falls back to Node.js for JSON parsing on Windows.

---

### 2. Client Playwright Tests (`apps/client/e2e/`)

| Spec File | Tests | Description |
|-----------|-------|-------------|
| `loyalty-dashboard.spec.ts` | 1 | Login → loyalty page → home → profile |
| `booking-flow.spec.ts` | 4 | Full booking flow, history, profile, auth negative |
| `notifications-payment.spec.ts` | 3 | Notifications page, branch discovery + services, profile + referral section |

**How to run:**
```bash
# Using npm script (recommended)
pnpm --filter @tmng/barber-client test:e2e

# Or directly
cd apps/client
npx playwright test

# Run a specific spec
npx playwright test booking-flow

# Run with headed browser (visible)
npx playwright test --headed

# Run with Playwright UI mode
pnpm --filter @tmng/barber-client test:e2e:ui

# Debug mode
npx playwright test --debug
```

---

### 3. Admin Playwright Tests (`apps/admin/e2e/`)

| Spec File | Tests | Description |
|-----------|-------|-------------|
| `queue-management.spec.ts` | 10 | Dashboard, queue, transactions, staff, branches, cash drawer, inventory, auth |
| `super-admin.spec.ts` | 18 | Super Admin sidebar, user management, audit log, analytics, reports, finance, config, RBAC |
| `pos-checkout.spec.ts` | 3 | POS checkout flow, commission view, inventory management |
| `new-features.spec.ts` | 4 | Notification management, retention management, dashboard charts, admin login flow |

**How to run:**
```bash
# Using npm script (recommended)
pnpm --filter @tmng/barber-admin test:e2e

# Or directly
cd apps/admin
npx playwright test

# Run only super admin tests
npx playwright test super-admin

# Run with headed browser
npx playwright test --headed

# Run with Playwright UI mode
pnpm --filter @tmng/barber-admin test:e2e:ui
```

---

### 4. Run All E2E Tests

```bash
# Run both admin and client E2E tests
pnpm test:e2e
```

---

## Test Data Requirements

The curl test suite creates its own test users:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `customer@test.com` | `Test1234!` | CUSTOMER | Customer flow tests |
| `manager@test.com` | `Manager1234!` | MANAGER | Admin/manager tests |
| `barber@test.com` | `Barber1234!` | BARBER | Barber-specific tests |
| `e2e_customer@test.com` | `E2eTest1234!` | CUSTOMER | E2E journey |
| `referred_user@test.com` | `Referred1234!` | CUSTOMER | Referral tests |
| `ref_b_customer@test.com` | `RefB1234!` | CUSTOMER | Referral B tests |
| `owner@barber.com` | `Password123!` | Owner (tenant) | Phase 6 Super Admin–style tests (seeded) |
| `admin@tmng.dev` | `PlatformAdmin123!` | PLATFORM_ADMIN | Platform-level tests (seeded) |

**Note:** In the new RBAC system, roles are assigned via `tenantRoleId`. Use the seeded users from `prisma/seed.ts` which have proper roles assigned. The curl script may create test users; for full RBAC coverage, prefer seeded users: `owner@barber.com`, `manager@barber.com`, `budi@barber.com`, `cashier@barber.com`, `customer1@gmail.com` (all with `Password123!`).

For Playwright tests, use the seeded credentials (e.g., `customer1@gmail.com` / `Password123!`).

---

## Business Flow Coverage

### Critical Flows Tested End-to-End

| Flow | Curl Section | Playwright |
|------|-------------|------------|
| Customer registration and login | 1, 10 | Client: auth tests |
| Online booking (branch → service → barber → time → confirm) | 6, 10 | Client: booking-flow |
| Walk-in queue management | 6, 26 | Admin: queue-management |
| Queue status transitions (WAITING → PAID) | 6, 10, 22, 26 | Admin: queue-management |
| POS checkout and payment | 7, 10 | — |
| Transaction void | 7 | — |
| Loyalty points earn and check | 22 | Client: loyalty-dashboard |
| Referral code apply and completion | 23 | — |
| Commission calculation | 14, 24 | — |
| Payroll lifecycle (generate → approve) | 15, 24 | — |
| Cash drawer daily workflow | 17, 25 | Admin: cash-drawer |
| Inventory management | 16 | Admin: inventory |
| Review creation and moderation | 13, 26 | — |
| CRM customer segments | 18 | — |
| Campaign management | 19 | — |
| RBAC enforcement (negative) | 9, 27, 34 | Auth negative tests |
| User & role management (SUPER_ADMIN) | 28 | Admin: super-admin |
| Audit log & anomaly detection | 29 | Admin: super-admin |
| Multi-branch analytics dashboard | 30 | Admin: super-admin |
| Report generation + CSV export | 31 | Admin: super-admin |
| Financial oversight (P&L) | 32 | Admin: super-admin |
| Platform config management | 33 | Admin: super-admin |
| Notification management (admin) | — | Admin: new-features |
| Retention management (admin) | — | Admin: new-features |
| Dashboard charts (revenue, payments) | — | Admin: new-features |
| POS checkout flow | — | Admin: pos-checkout |
| Commission view | — | Admin: pos-checkout |
| Branch discovery | — | Client: notifications-payment |
| Optional prepayment + penalized cancel (prepaid only) | — | Covered by API Vitest (`queue`); E2E optional |
| Waitlist join / admin manage | — | API Vitest (`waitlist`); client UI hooks via MSW |
| Report PDF + schedules + templates | — | API Vitest (`reports`); admin widget tests (`reports/__tests__`) |
| i18n locale switch (en/id) | — | Manual / Playwright optional; strings from JSON namespaces |

### Flows NOT Yet Tested (Curl/Playwright)

| Flow | Reason |
|------|--------|
| Xendit payment integration | Requires Xendit API keys |
| OneSignal push notifications | Requires OneSignal account (unit tests mock the service) |
| OAuth (Google) login | Google implemented; Apple descoped |
| ~~Phone OTP verification~~ | Descoped |
| Offline POS sync (IndexedDB → API) | Requires browser automation with network throttling |
| WebSocket real-time updates | Requires Soketi server + wscat |
| In-app notifications API | Not in curl tests yet (covered by Vitest + admin E2E) |
| Saved payment methods API | Not in curl tests yet (covered by Vitest) |
| Staff photo / branch image upload | Requires MinIO (covered by Vitest unit tests) |
| Referral expiry cron | Scheduler not testable via E2E (covered by Vitest) |

---

## Vitest Unit Tests

Unit tests run with Vitest across all 3 apps. API tests use Hono `testClient`, admin/client tests use MSW for mocking.

**Inventory (post–Sprint 9):** **822** tests total — API **545** (31 feature test files), admin **167** (26 files under `__tests__`), client **110** (13 files). Extend MSW handlers when adding hooks for new routes: **waitlist**, **report schedules / saved templates**, **PDF export** (binary responses may use `fetch` mocks in API tests), **org config** keys for customer self-service (`PREPAYMENT_*`, `CANCELLATION_*`, `WAITLIST_*`).

**Sprint 9 focus areas:** **i18n** — `react-i18next` in app providers; exercise keys via existing widget/page tests or add switcher tests. **Reports** — schedule/template CRUD, PDF path, email service mocked in API tests. **Waitlist** — `waitlist.test.ts` (customer + admin, RBAC). **Prepayment / cancellation** — `queue.test.ts` coverage for `prepaymentReference`, `refundAmount`, penalty logic.

**How to run:**
```bash
# All apps
pnpm test

# Individual apps
pnpm --filter @tmng/saas-api test
pnpm --filter @tmng/barber-admin test
pnpm --filter @tmng/barber-client test
```

### API Tests (`apps/api/src/features/*/*.test.ts`)

| Feature | Test File | Coverage |
|---------|-----------|----------|
| Analytics | `analytics/analytics.test.ts` | Schema validation, endpoint auth |
| Attendance | `attendance/attendance.test.ts` | Schema validation, endpoint auth |
| Audit | `audit/audit.test.ts` | Schema validation, endpoint auth |
| Auth | `auth/auth.test.ts` | Login, register, Google OAuth, token refresh |
| Branches | `branches/branches.test.ts` | Schema validation, CRUD |
| Campaigns | `campaigns/campaigns.test.ts` | Schema validation, CRUD |
| Cash Drawer | `cash-drawer/cash-drawer.test.ts` | Schema validation, open/close/entries |
| Commissions | `commissions/commissions.test.ts` | Schema validation |
| Config | `config/config.test.ts` | Schema validation, config keys (incl. Sprint 9 self-service keys) |
| CRM | `crm/crm.test.ts` | Schema validation |
| Finance | `finance/finance.test.ts` | Schema validation |
| Health | `health/health.test.ts` | Health check endpoint |
| Inventory | `inventory/inventory.test.ts` | Schema validation, stock movements |
| Loyalty | `loyalty/loyalty.test.ts` | Schema validation |
| Media | `media/media.test.ts` | Upload validation |
| Notifications | `notifications/notifications.test.ts` | List, unread count, mark read, mark all read, auth, admin list/stats/test-send |
| Payments | `payments/payments.test.ts` | Schema validation, saved payment methods (list, save, delete, max limit) |
| Payroll | `payroll/payroll.test.ts` | Schema validation |
| Platform | `platform/platform.test.ts` | Schema validation |
| Promotions | `promotions/promotions.test.ts` | Schema validation |
| Queue | `queue/queue.test.ts` | Schema validation, push notifications (booking confirmed, CALLED, COMPLETED), Sprint 9 prepayment/cancel penalty/refund paths |
| Referrals | `referrals/referrals.test.ts` | Schema validation |
| Reports | `reports/reports.test.ts` | Schema validation, CSV/PDF export, `ReportSchedule` / `SavedReportTemplate` CRUD, RBAC |
| Retention | `retention/retention.test.ts` | Schema validation |
| Reviews | `reviews/reviews.test.ts` | Schema validation |
| Roles | `roles/roles.test.ts` | Schema validation |
| Services | `services/services.test.ts` | Schema validation |
| Staff | `staff/staff.test.ts` | Schema validation |
| Transactions | `transactions/transactions.test.ts` | Schema validation, CRUD |
| Users | `users/users.test.ts` | Schema validation |

### Admin Tests (`apps/admin/src/features/*/__tests__/*.test.tsx`)

| Feature | Test File | Coverage |
|---------|-----------|----------|
| Analytics | `analytics/__tests__/analytics.test.tsx` | Hook success/error, widget render |
| Attendance | `attendance/__tests__/attendance.test.ts` | Hook success/error |
| Audit | `audit/__tests__/audit.test.tsx` | Hook success/error, widget render |
| Auth | `auth/__tests__/auth.test.ts` | Hook success/error |
| Barbers | `barbers/__tests__/barbers.test.ts` | Hook success/error |
| Branches | `branches/__tests__/branches.test.ts` | Hook success/error |
| Cash Drawer | `cash-drawer/__tests__/cash-drawer.test.ts` | Hook success/error |
| Commissions | `commissions/__tests__/commissions.test.tsx` | Hook success/error, widget render |
| Config | `config/__tests__/config.test.tsx` | Hook success/error, widget render (incl. Customer Self-Service keys — Sprint 9) |
| Dashboard | `dashboard/__tests__/dashboard.test.tsx` | Widget render |
| Finance | `finance/__tests__/finance.test.tsx` | Hook success/error, widget render |
| Inventory | `inventory/__tests__/inventory.test.tsx` | Hook success/error, widget render |
| Loyalty | `loyalty/__tests__/loyalty.test.tsx` | Hook success/error |
| Payroll | `payroll/__tests__/payroll.test.tsx` | Hook success/error |
| POS | `pos/__tests__/pos.test.tsx` | Hook success/error, widget render |
| Queue | `queue/__tests__/queue.test.ts` | Hook success/error |
| Reports | `reports/__tests__/reports.test.tsx` | Hook success/error, widget render (Generate / Schedules / Templates tabs — Sprint 9) |
| Reviews | `reviews/__tests__/reviews.test.tsx` | Hook success/error |
| Transactions | `transactions/__tests__/transactions.test.tsx` | Hook success/error |
| Users | `users/__tests__/users.test.tsx` | Hook success/error, widget render |
| Notifications | `notifications/__tests__/notifications.test.tsx` | Stats cards render, notification table, test send button |
| Retention | `retention/__tests__/retention.test.tsx` | Stats cards, trigger policy info, manual trigger button, confirmation dialog |

### Client Tests (`apps/client/src/features/*/__tests__/*.test.ts`)

| Feature | Test File | Coverage |
|---------|-----------|----------|
| Auth | `auth/__tests__/auth.test.ts` | Store, login/logout, token management |
| Booking (components) | `booking/__tests__/booking-components.test.tsx` | Barber selection render |
| Booking (hooks) | `booking/__tests__/booking-hooks.test.ts` | Hook success/error |
| Booking (store) | `booking/__tests__/store.test.ts` | Zustand store state |
| Branches | `branches/__tests__/branches.test.ts` | Hook success/error |
| Loyalty | `loyalty/__tests__/loyalty.test.ts` | Hook success/error |
| Notifications | `notifications/__tests__/notifications.test.ts` | List, unread count, error states |
| Payments | `payments/__tests__/payments.test.ts` | List methods, empty state, error states |
| Profile | `profile/__tests__/profile.test.ts` | Hook success/error |
| Queue | `queue/__tests__/queue.test.ts` | Hook success/error |
| Reviews | `reviews/__tests__/reviews.test.ts` | Hook success/error |

---

## CI/CD Integration

The project has a live CI workflow at `.github/workflows/ci.yml` with three jobs:

1. **verify** — Runs `lint`, `typecheck`, and `test` (Vitest) across all apps on every push/PR.
2. **e2e** — Runs Playwright E2E tests (admin) on pull requests. Installs Playwright browsers, builds apps, and uploads test reports on failure.
3. **docker** — Builds and pushes the API Docker image to GHCR on pushes to `main`.

**Key scripts:**

```bash
# Run Vitest across all apps
pnpm test

# Run E2E tests for both admin and client
pnpm test:e2e

# Run E2E for a specific app
pnpm --filter @tmng/barber-admin test:e2e
pnpm --filter @tmng/barber-client test:e2e

# Run E2E with Playwright UI mode
pnpm --filter @tmng/barber-admin test:e2e:ui
```

**For local curl integration tests (require running API + seeded DB):**

```bash
bash scripts/run-tests.sh api     # API curl tests only
bash scripts/run-tests.sh all     # All test suites
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `jq: command not found` | Script falls back to Node.js automatically. Or install jq. |
| `Connection refused` on curl tests | Ensure API server is running on port 8787 |
| Playwright tests time out | Ensure dev servers are running. Check `PLAYWRIGHT_BASE_URL` env var. |
| `manager@test.com` gets 403 | Use seeded users: `manager@barber.com` / `Password123!` (Manager role via tenantRoleId). Or ensure test user has correct tenantRoleId assigned in the database. |
| Media upload test fails | Ensure MinIO/S3 is running and configured in `.dev.vars` |
| `base64: invalid input` on Windows | The media test creates a test PNG; on Windows Git Bash the base64 command may differ |
