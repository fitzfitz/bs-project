# Development Guide

> How to set up the dev environment, write code, test, and verify changes.

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22 LTS | Runtime |
| pnpm | Latest | Package manager (NEVER use npm/yarn/bun) |
| PostgreSQL | 15+ | Database |
| Docker | Latest | Optional: for MinIO, Soketi, Postgres |

---

## 2. Getting Started

```bash
# Clone and install
git clone <repo-url>
cd bs-project
pnpm install

# Database setup
cp apps/api/.env.example apps/api/.dev.vars
# Edit .dev.vars with your DATABASE_URL, JWT secrets, etc.

pnpm --filter @tmng/saas-api db:push    # Apply schema
pnpm --filter @tmng/saas-api db:seed    # Seed reference data

# Start development servers
pnpm dev:api      # API on http://localhost:8787
pnpm dev:admin    # Admin on http://localhost:5175
pnpm dev:client   # Client on http://localhost:5174
```

API documentation is auto-generated at `http://localhost:8787/api/docs` (Swagger UI).

---

## 3. Workspace Commands

```bash
# Development
pnpm dev:api                           # Start API dev server
pnpm dev:admin                         # Start admin dev server
pnpm dev:client                        # Start client dev server

# Verification (run in this order)
pnpm --filter <app> lint               # ESLint
pnpm --filter <app> typecheck          # TypeScript strict mode
pnpm --filter <app> test               # Vitest unit tests

# Full verification
pnpm verify                            # lint + typecheck + test for all apps

# Database
pnpm --filter @tmng/saas-api db:push   # Apply Prisma schema
pnpm --filter @tmng/saas-api db:seed   # Seed data
pnpm --filter @tmng/saas-api db:reset  # Reset + reseed

# E2E tests
pnpm --filter @tmng/barber-admin test:e2e
pnpm --filter @tmng/barber-client test:e2e

# Dependencies (always use pnpm, never edit package.json by hand)
pnpm --filter <pkg> add <dep>
```

---

## 4. Mandatory Workflow: Spec → Test → Implement → Verify

Every feature change must follow this exact order:

### Step 1: Spec First

Read or create the OpenSpec at `openspec/specs/<app>/<feature>/spec.md`. The spec defines endpoints, request/response shapes, business rules, success/failure scenarios, and HTTP status coverage.

### Step 2: Test First (TDD)

Write failing tests based on the spec scenarios:

| App | Test Location | Runner |
|-----|--------------|--------|
| API | `src/features/<name>/[name].test.ts` | Vitest + Hono testClient |
| Admin | `src/features/<name>/__tests__/*.test.tsx` | Vitest + MSW |
| Client | `src/features/<name>/__tests__/*.test.tsx` | Vitest + MSW |

Tests WILL fail at this point — that is correct.

### Step 3: Implement

Write minimum code to make failing tests pass.

**API implementation order:** `schema.ts` → `handlers.ts` → `service.ts` → `index.ts`

**Frontend implementation order:** types → hooks → widgets/components → pages

### Step 4: Verify

```bash
pnpm --filter <app> lint
pnpm --filter <app> typecheck
pnpm --filter <app> test
```

All three must pass with zero errors before the task is complete.

### Step 5: Update Docs

Review and update relevant documentation (specs, feature catalog, business logic).

---

## 5. Project Structure

### API (`apps/api/src/`)

```
src/
├── index.ts            # Composition root: middleware chain + route mounting
├── server.ts           # Node.js entry point
├── scheduler.ts        # Background cron jobs (node-cron)
├── types.ts            # AppEnv type
├── features/           # 30 domain modules (4-file pattern)
│   └── <name>/
│       ├── [name].schema.ts     # Zod schemas + createRoute() definitions
│       ├── [name].index.ts      # OpenAPIHono router + middleware wiring
│       ├── [name].handlers.ts   # HTTP controllers
│       └── [name].service.ts    # Business logic + Prisma queries
├── middlewares/         # auth, rbac, scope, rate-limit, cache, platform-auth
├── utils/              # db, env, s3, pusher, notifications, openapi, xendit-adapter
└── test/               # Shared test helpers + setup
```

### Frontend (`apps/admin/src/` and `apps/client/src/`)

```
src/
├── app/           # Bootstrap: main.tsx, providers.tsx, app.tsx
├── components/    # Shared UI (Shadcn primitives, layout shells)
├── features/      # Domain slices: api/ hooks, widgets, components, store
├── pages/         # Composition: assembles feature widgets per route
├── lib/           # Infrastructure: API client, query client, utils
├── routes/        # Guards: ProtectedRoute, RequirePermission
├── i18n/          # Translations: en/id JSON namespaces
├── hooks/         # Shared hooks (Pusher)
├── store/         # Global client state (Zustand)
└── test/          # MSW handlers, Vitest setup
```

---

## 6. Code Conventions

### Read-Before-Write
- Before modifying any file, read it first
- Before creating a file, read a sibling to learn conventions
- Before importing a module, verify the path exists
- Never guess function signatures — read the source

### Dependencies
- Never assume a package is installed — check `package.json`
- Use `pnpm --filter <pkg> add <dep>` to add dependencies
- Never edit `package.json` by hand

### API Routes
- All routes MUST use `createRoute()` + `app.openapi()` from `@hono/zod-openapi`
- Standard `app.get()`/`app.post()` is forbidden (except health module)
- Zod v4 for schemas; import `z` from `@hono/zod-openapi` in schema files
- Response envelope: `{ success, data?, message?, pagination? }`

### Frontend
- All forms use `react-hook-form` with `@hookform/resolvers/zod`
- All queries in `features/*/api/` hooks — no inline `useQuery` in pages
- Both apps use `usePusherChannel` hook for real-time updates

### Multi-Tenancy
- Every query must be scoped to `organizationId`
- Use `orgScopeMiddleware()` on all non-public routes
- Use generic naming: `staff` not `barber`, `StaffProfile` not `BarberProfile`

### Timestamps
- Store and transmit in UTC
- Format to local timezone (WIB UTC+7) only at the UI rendering layer

---

## 7. Design System (Admin)

The admin dashboard uses a design system documented in `docs/design_system.md`. Two Cursor rules enforce consistency:

- **`.cursor/rules/design-system.mdc`** — Enforces use of composite components (PageHeader, PageContainer, QueryState, etc.) over ad-hoc patterns.
- **`.cursor/rules/style-discipline.mdc`** — Enforces Tailwind-only styling, semantic color tokens, typography scale, spacing conventions, and i18n requirements.

### Composite Components (`@/components/ui/`)

| Component | Purpose | Replaces |
|-----------|---------|----------|
| `PageHeader` | Standardized page title bar with actions slot | Ad-hoc `<h1>` elements |
| `PageContainer` | Consistent page-level spacing wrapper | Bare `<div>` wrappers |
| `QueryState` | Loading/error/empty handling for TanStack Query | Manual `if (isLoading)` checks |
| `StatCard` | Metric/KPI display with trends | Local stat card implementations |
| `EmptyState` | No-data display with icon and CTA | Inline "No data" text |
| `StatusBadge` | Semantic colored status indicator | Ad-hoc colored badges |
| `DataCardGrid` | Responsive grid for stat cards | Repeated `grid grid-cols-*` |

### Shell Components (`@/components/layout/`)

- **Sidebar** — Grouped, collapsible navigation with RBAC filtering and localStorage persistence
- **Topbar** — Breadcrumbs, profile dropdown, command palette (Ctrl+K), notification bell, branch selector
- **Breadcrumbs** — Auto-generated from route via `lib/nav-config.ts`
- **CommandMenu** — Global search/navigation (Ctrl+K / Cmd+K)

### Key Rules

- Every page MUST use `PageContainer` + `PageHeader`
- Every query-dependent UI MUST use `QueryState`
- All navigation defined in `lib/nav-config.ts` (single source of truth)
- All user-visible strings MUST use i18n `t()` — never hardcoded text
- Colors MUST use semantic tokens (`primary`, `destructive`, `success`, `warning`, `info`)

---

## 8. Testing

### Test Counts (Current)

| App | Tests | Files |
|-----|-------|-------|
| API | 553 | 31 feature test files |
| Admin | 257 | 33 test files (26 feature `__tests__/` + 4 `components/__tests__/` + 2 `lib/__tests__/` + 1 `features/waitlist/__tests__/`) |
| Client | 141 | 15 test files (11 feature `__tests__/` + 2 `lib/__tests__/` + 2 `components/__tests__/`) |
| **Total** | **951** | |
| E2E (Playwright) | 9 spec files | 6 admin + 3 client |

### Running Tests

```bash
# Unit tests (Vitest)
pnpm test                              # All apps
pnpm --filter @tmng/saas-api test      # API only
pnpm --filter @tmng/barber-admin test  # Admin only
pnpm --filter @tmng/barber-client test # Client only

# E2E tests (Playwright — requires dev servers running)
pnpm --filter @tmng/barber-admin test:e2e
pnpm --filter @tmng/barber-client test:e2e

# Install Playwright browsers (first time)
cd apps/admin && npx playwright install chromium
cd apps/client && npx playwright install chromium
```

### Seeded Test Users

| Email | Password | Role | Use For |
|-------|----------|------|---------|
| `owner@barber.com` | `Password123!` | Owner (HQ) | Super admin tests |
| `manager@barber.com` | `Password123!` | Manager (BRANCH) | Branch management tests |
| `budi@barber.com` | `Password123!` | Barber (BRANCH) | Staff portal tests |
| `cashier@barber.com` | `Password123!` | Cashier (BRANCH) | POS/queue tests |
| `customer1@gmail.com` | `Password123!` | Customer | Customer flow tests |
| `admin@tmng.dev` | `PlatformAdmin123!` | Platform Admin | Platform API tests |

---

## 9. Environment Variables

The API requires these env vars (documented in `apps/api/.env.example`):

**Required:**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Token signing keys (min 32 chars)

**Optional (graceful degradation when absent):**
- `PUSHER_*` — Soketi/Pusher config (real-time disabled without)
- `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` — Push notifications
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` / `TWILIO_SMS_FROM` — WhatsApp/SMS
- `S3_*` / `MINIO_*` — Media upload (MinIO)
- `XENDIT_SECRET_KEY` / `XENDIT_CALLBACK_TOKEN` — Payment gateway
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` — Report email delivery
- `GOOGLE_CLIENT_ID` — Google OAuth verification
- `LOG_LEVEL` — pino log level (default: `info`)
- `DB_POOL_MAX` — PostgreSQL pool size (default: 10)

---

## 10. CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **verify** — Runs lint + typecheck + test (Vitest) on every push/PR
2. **e2e** — Playwright E2E tests on pull requests
3. **docker** — Builds and pushes API Docker image to GHCR on push to main

Deploy workflow (`.github/workflows/deploy-api.yml`): Docker build → GHCR push → SSH deploy to VPS.

---

## 11. OpenSpec Workflow

Feature specifications live in `openspec/specs/<app>/<feature>/spec.md`:

- **Propose**: Create proposal with design, specs, and tasks (`/opsx:propose`)
- **Apply**: Implement tasks from the spec (`/opsx:apply`)
- **Archive**: Finalize completed change (`/opsx:archive`)

The spec is the source of truth. If code disagrees with the spec, the code is wrong.
