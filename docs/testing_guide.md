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

**How to run:**
```bash
cd apps/client
npx playwright test

# Run a specific spec
npx playwright test booking-flow

# Run with headed browser (visible)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

---

### 3. Admin Playwright Tests (`apps/admin/e2e/`)

| Spec File | Tests | Description |
|-----------|-------|-------------|
| `queue-management.spec.ts` | 10 | Dashboard, queue, transactions, staff, branches, cash drawer, inventory, auth |
| `super-admin.spec.ts` | 18 | Super Admin sidebar, user management, audit log, analytics, reports, finance, config, RBAC |

**How to run:**
```bash
cd apps/admin
npx playwright test

# Run only super admin tests
npx playwright test super-admin

# Run with headed browser
npx playwright test --headed
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

### Flows NOT Yet Tested

| Flow | Reason |
|------|--------|
| Xendit payment integration | Requires Xendit API keys |
| OneSignal push notifications | Requires OneSignal account |
| OAuth (Google/Apple) login | Not implemented yet |
| Phone OTP verification | Not implemented yet |
| Offline POS sync (IndexedDB → API) | Requires browser automation with network throttling |
| WebSocket real-time updates | Requires Soketi server + wscat |

---

## CI/CD Integration

To run tests in CI (GitHub Actions), add to `.github/workflows/test.yml`:

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: tmng_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install
      - run: pnpm --filter @tmng/saas-api db:push
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/tmng_test
      - run: pnpm --filter @tmng/saas-api db:seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/tmng_test
      - run: pnpm --filter @tmng/saas-api dev &
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/tmng_test
          JWT_SECRET: test-jwt-secret-must-be-at-least-32-chars
          JWT_REFRESH_SECRET: test-refresh-secret-must-be-at-least-32-chars
      - run: sleep 5 && bash scripts/run-tests.sh api

  playwright-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install
      - run: npx playwright install --with-deps chromium
      # Start servers and run tests...
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
