# TMNG SaaS Platform — Overview

> Start here. This document gives newcomers a complete understanding of what TMNG is, how it works, and how the pieces fit together.

---

## 1. What Is TMNG?

TMNG is a **headless, multi-tenant SaaS engine** for appointment-based service businesses. The backend API is fully industry-agnostic — the same API powers barbershops, vet clinics, massage studios, or any business that takes appointments, manages staff, and processes payments. Each frontend is a themed "skin" for a specific industry.

**SaaS Type:** Multi-Vertical B2B2C Platform

- **B2B**: Business owners (barbershop owner, vet clinic owner, spa owner) subscribe to the platform
- **B2C**: End consumers use the client app to book appointments, pay, and leave reviews
- **Multi-Vertical**: One API serves multiple industries with shared core features

**Target Industries:** Barbershops, vet clinics, massage studios, nail salons, auto detailing, dental clinics, spas, pet grooming, tattoo parlors, beauty salons — any appointment-based service business.

**Common features across all industries:**
- Queue / appointment scheduling
- Staff management & scheduling
- Service catalog & pricing (with tier surcharges, combos)
- Point of Sale (POS) / transactions
- Inventory & retail
- Payroll & commissions
- Customer loyalty, referrals & reviews
- CRM, campaigns & retention
- Analytics, reporting & financial oversight
- Multi-channel notifications (push, WhatsApp, SMS, in-app)

---

## 2. Architecture

```
                         ┌──────────────────────────┐
                         │     @tmng/saas-api        │
                         │    (Headless Engine)       │
                         │                            │
                         │  - Multi-tenant            │
                         │  - Feature-based RBAC      │
                         │  - Industry-agnostic       │
                         │  - Org-scoped queries      │
                         └─────────────┬──────────────┘
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
    ┌──────────▼──────────┐ ┌──────────▼──────────┐ ┌─────────▼───────────┐
    │ @tmng/barber-admin  │ │ @tmng/barber-client │ │ Future frontends    │
    │ (admin dashboard)   │ │ (customer PWA)      │ │ @tmng/vet-admin     │
    │ Desktop-first       │ │ Mobile-first        │ │ @tmng/massage-client│
    └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### Monorepo Structure

```
bs-project/                          # pnpm workspace root
├── apps/
│   ├── api/                         # @tmng/saas-api — Hono.js REST API (Node.js 22)
│   ├── admin/                       # @tmng/barber-admin — Admin dashboard (React 19)
│   └── client/                      # @tmng/barber-client — Customer PWA (React 19)
├── packages/                        # Shared packages (reserved for future)
├── docs/                            # Architecture & planning docs
└── openspec/                        # Feature specifications (spec.md per feature)
```

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **API Runtime** | Hono.js on Node.js 22 LTS | Lightweight, TypeScript-native, OpenAPI auto-generation |
| **API Framework** | `@hono/zod-openapi` | All routes defined via `createRoute()` for type safety + auto docs |
| **Database** | PostgreSQL + Prisma ORM | 56 models, multi-tenant with `organizationId` on all tables |
| **Frontend** | React 19 + Vite 7 + TypeScript | Strict mode, feature-based architecture |
| **Styling** | Tailwind CSS v4 + Shadcn/ui | Config-less Tailwind, Maia preset |
| **Server State** | TanStack Query | Caching, pagination, optimistic updates |
| **Client State** | Zustand | UI state, session state |
| **Forms** | React Hook Form + Zod | All forms validated via `@hookform/resolvers/zod` |
| **i18n** | react-i18next | English + Indonesian, namespace JSON files |
| **Real-time** | Soketi (Pusher-compatible) | Self-hosted WebSocket server for live queue updates |
| **Validation** | Zod v4 | Single source of truth for types on both frontend and backend |
| **Testing** | Vitest + MSW + Playwright | 830 unit tests + 9 E2E specs |
| **Package Manager** | pnpm | Workspace monorepo with `@tmng/` scope |
| **CI/CD** | GitHub Actions | Lint, typecheck, test, Docker build, GHCR push, VPS deploy |

---

## 3. Multi-Tenancy Model

Single shared database with `organizationId` on every tenant-level table. Data isolation is enforced at the middleware level — every Prisma query is automatically scoped to the current organization.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM LEVEL                                  │
│                   (managed by TMNG platform admins)                     │
│                                                                         │
│  PlatformAdmin     Feature (global catalog)    IndustryTemplate         │
│  ──────────────    ────────────────────────    ─────────────────        │
│  PLATFORM_ADMIN    QUEUE_MANAGEMENT            BARBERSHOP template     │
│  PLATFORM_SUPPORT  PAYROLL                     VET_CLINIC template     │
│                    INVENTORY                    MASSAGE template        │
│                    ANALYTICS                    GENERAL_SERVICE         │
│                    25 features total                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TENANT LEVEL (per Organization)                     │
│                                                                         │
│  Organization ──────── TenantRole ──────── TenantRolePermission        │
│  "Budi's Barbershop"  "Owner" (HQ scope)  QUEUE: C✓ R✓ U✓ D✓         │
│  industryType:         "Manager" (BRANCH)  PAYROLL: C✗ R✓ U✗ D✗      │
│    BARBERSHOP          "Barber" (BRANCH)   ATTENDANCE: C✓ R✓ U✗ D✗   │
│  taxRate: 0.11         "Cashier" (BRANCH)                              │
│  currency: IDR         "Customer" (CUST)   TenantRoleService           │
│                                             "Barber" → [Haircut, Shave]│
│  Branch ──── User ──── StaffProfile / CustomerMembership               │
│  "Central"   branchId  tier, status,        loyaltyPoints,             │
│  "Kemang"    tenantRoleId  commission       referralCode               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Users belong to exactly one organization (no cross-org identity sharing)
- Same email at different orgs = two separate accounts
- `scopeToOrg()` middleware auto-injects `WHERE organizationId = ?` into every Prisma query
- Platform admin is a separate auth flow with its own `PlatformAdmin` table

### Role Scope System

| Scope | branchId | Data Access | Example Roles |
|-------|----------|-------------|---------------|
| `HQ` | null | All branches in org | Owner, HR, Finance Director |
| `BRANCH` | specific branch | Filtered to user's branch | Manager, Barber, Cashier, Supervisor |
| `CUSTOMER` | null | Filtered to user's own data | Customer, Pet Owner, Client |

### RBAC (Database-Driven)

25 feature codes with CRUD permissions. Each `TenantRole` has a `TenantRolePermission` row per feature with boolean `canCreate`, `canRead`, `canUpdate`, `canDelete`. Permission checks are cached in an LRU cache with 5-minute TTL. See [rbac_system.md](rbac_system.md) for the full feature catalog.

### Service Provider Model

`TenantRole.isServiceProvider` controls whether a role performs services:
- `true` → StaffProfile created, appears in booking selection, gets attendance/commission/payroll
- `false` → Administrative staff only (Manager, Cashier, HR)

Service-to-role restrictions via `TenantRoleService` — e.g., Junior Barbers can only do Haircut + Shave, Master Barbers can do everything.

---

## 4. API Architecture

Feature-driven layered architecture with 30 modules following a consistent 4-file pattern:

```
src/features/<name>/
├── [name].schema.ts     # Zod schemas + createRoute() OpenAPI definitions
├── [name].handlers.ts   # HTTP controllers (extract → call service → respond)
├── [name].service.ts    # Business logic + Prisma queries
└── [name].index.ts      # OpenAPIHono router, middleware wiring
```

**Middleware stack (applied per-route):**

| Middleware | Purpose |
|-----------|---------|
| `authMiddleware()` | JWT verification, extracts userId/orgId/roleId/scope |
| `orgScopeMiddleware()` | Injects org-scoped Prisma client |
| `requirePermission(feature, action)` | Database-driven RBAC check (25 features × CRUD) |
| `requireCustomer()` | Verifies customer role |
| `requireStaff()` | Verifies service provider role |
| `platformAuthMiddleware()` | Platform admin JWT (separate from tenant auth) |
| `rateLimitMiddleware()` | Sliding-window rate limiting |
| `cacheMiddleware()` | LRU GET cache with mutation invalidation |

**API response envelope:** All responses follow `{ success, data?, message?, pagination? }`. Frontend `lib/api.ts` unwraps this automatically.

**API docs:** Auto-generated OpenAPI at `/api/docs` (Swagger UI) and `/api/openapi.json`. V2 mount point scaffolded at `/api/v2` with `X-API-Version` header on all responses.

---

## 5. Frontend Architecture

Both frontend apps follow a feature-based architecture with strict layer separation:

```
src/
├── app/           # Bootstrap: main.tsx, providers.tsx, app.tsx (route table)
├── components/    # Shared UI (Shadcn primitives, layout shells)
├── features/      # Domain slices: api/ hooks, widgets, components, store, types
├── pages/         # Composition layer: assembles feature widgets per route
├── lib/           # Infrastructure: Axios client, query client, utilities
├── routes/        # Guards: ProtectedRoute, RequirePermission
├── i18n/          # Translations: en/id JSON namespaces
├── hooks/         # Shared hooks (Pusher)
├── store/         # Global client state (Zustand)
└── test/          # MSW handlers, Vitest setup
```

**Admin app** (`@tmng/barber-admin`): Desktop-first, 29 pages, RBAC-gated sidebar and routes. Features: queue Kanban, POS with offline fallback, staff management, analytics dashboards, financial oversight, configuration.

**Client app** (`@tmng/barber-client`): Mobile-first PWA, 16 pages. Features: branch discovery (map + list), 4-step booking flow, loyalty dashboard, reviews, notification inbox, payment methods, receipt viewer.

Both apps use `vite-plugin-pwa` with Workbox for service worker caching and installability.

---

## 6. Third-Party Integrations

| Service | Provider | Purpose | Self-Hosted? |
|---------|----------|---------|--------------|
| **Database** | PostgreSQL | All persistent data (56 models) | Yes (VPS) |
| **WebSocket** | Soketi | Live queue updates, real-time notifications | Yes (VPS, Docker) |
| **Media Storage** | MinIO | Staff photos, branch images, review photos, product photos | Yes (VPS, Docker) |
| **Payment Gateway** | Xendit | QRIS, credit card, virtual account. Charge creation, webhooks, saved cards (tokenized) | No (SaaS) |
| **Push Notifications** | OneSignal | Web push to customers (booking, queue status, reminders, campaigns) | No (Free tier) |
| **WhatsApp** | Twilio | Template-based WhatsApp messages for notifications | No (SaaS) |
| **SMS** | Twilio | Plain text SMS notifications (shared Twilio account) | No (SaaS) |
| **Email** | nodemailer (SMTP) | Scheduled report delivery (PDF + CSV attachments) | Config-dependent |
| **Logging** | pino | Structured JSON logging with request correlation IDs | Built-in |

All third-party integrations gracefully degrade when env vars are not configured — the system logs instead of crashing.

---

## 7. Infrastructure & Deployment

```
┌──────────────────────────────────────────────────────────────────────┐
│                          VPS (Docker)                                │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ API      │  │ Soketi   │  │ MinIO    │  │ Postgres │           │
│  │ :8787    │  │ :6001    │  │ :9000    │  │ :5432    │           │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────────┘           │
│        │              │              │                               │
│  ┌─────▼──────────────▼──────────────▼────────────────────┐        │
│  │              Nginx Reverse Proxy                        │        │
│  │  api.domain.com → :8787                                 │        │
│  │  ws.domain.com  → :6001                                 │        │
│  │  media.domain.com → :9000                               │        │
│  │  admin.domain.com → /opt/admin/ (static)                │        │
│  │  app.domain.com → /opt/client/ (static)                 │        │
│  └────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
```

**CI/CD:** GitHub Actions → Docker build → GHCR push → SSH deploy to VPS. Triggered on push to main.

**Database backups:** Automated daily at 02:00 via `scripts/backup-db.sh` (pg_dump + gzip, 7-day retention).

See [deployment.md](deployment.md) for detailed setup instructions.

---

## 8. Background Scheduler

All automated jobs run via `node-cron` in the API process (`src/scheduler.ts`):

| Schedule | Job | Description |
|----------|-----|-------------|
| Every 5 min | NO_SHOW timeout | CALLED queue entries older than 5 min → NO_SHOW |
| Every 5 min | Grace period release | Late online bookings (10 min past) → NO_SHOW, release staff |
| Every 5 min | Appointment reminders | Push notification 25-30 min before scheduled bookings |
| Every 5 min | Waitlist expiry | Expired waitlist entries → EXPIRED status |
| Every 15 min | Auto clock-out | Staff still clocked in after branch closing → auto clock-out |
| Every 15 min | Anomaly detection | Flag excessive voids, high discounts, off-hours activity |
| Daily 02:00 UTC | Nightly snapshots | Compute `BranchDailySnapshot` for previous day |
| Daily 02:15 UTC | Demand forecast | Time-series forecast computation for all active branches |
| Daily 03:00 UTC | Point expiry | Expire loyalty points past their expiration date |
| Daily 03:05 UTC | Retention triggers | At-risk and points-expiry nudges via push notifications |
| Daily 03:10 UTC | Referral expiry | PENDING referrals past `expiresAt` → EXPIRED |
| Weekly Mon 04:00 UTC | Churn scoring | Weighted RFM churn score recomputation for all branches |
| Hourly | Report delivery | Process due `ReportSchedule` rows (generate PDF/CSV, email via SMTP) |

---

## 9. Platform Admin (API-Only)

Platform-level management (org CRUD, industry templates, feature catalog) is handled via dedicated API endpoints under `/api/platform` with separate `PlatformAdmin` authentication. There is no platform admin UI in the current admin dashboard — this is by design. Platform operations are intended to be API-first for TMNG internal staff.

---

## 10. Organization Settings

Each org carries its own configuration via `PlatformConfig` key-value pairs:

- **Tax**: `TAX_RATE`, tax name/type, inclusive/exclusive
- **Currency & Locale**: ISO 4217 currency code, symbol, timezone, locale
- **Loyalty**: Points earn rate, redemption rate, tier thresholds, expiry window
- **Referrals**: Bonus points, expiry days
- **Commission**: Per-tier default rates (MASTER/SENIOR/JUNIOR)
- **POS**: Tax rate, digital wallet support
- **Customer Self-Service**: Prepayment enabled, deposit %, cancellation policy hours/penalty %, waitlist enabled/max per slot

Branch-level overrides: `tipDistribution` and `maxDiscountPercent` can be set per branch (null = use org default).

---

## 11. Multi-Industry Example

The same API instance serves different business types:

```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Org: "Budi's Barbershop"       │  │  Org: "Happy Paws Vet Clinic"   │
│  Industry: BARBERSHOP            │  │  Industry: VET_CLINIC            │
│                                  │  │                                  │
│  Roles: Owner, Manager, Barber,  │  │  Roles: Owner, Vet, Groomer,    │
│    Jr Barber, Cashier, Customer  │  │    Receptionist, Pet Owner       │
│                                  │  │                                  │
│  Services: Haircut, Shave,       │  │  Services: Vaccination,          │
│    Hair Color (Master only)      │  │    Grooming, Check-up, Bath      │
│                                  │  │                                  │
│  Frontend: @tmng/barber-*        │  │  Frontend: @tmng/vet-* (future)  │
│  API: @tmng/saas-api ◄──────────┼──┼──▶ API: @tmng/saas-api           │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

---

## 12. Documentation Index

| Document | Purpose |
|----------|---------|
| **[platform_overview.md](platform_overview.md)** | This file — start here |
| **[features.md](features.md)** | Complete feature catalog with API endpoints, admin/client pages, workflows |
| **[business_logic.md](business_logic.md)** | Core business rules, state machines, pricing calculations (22 domains, industry-agnostic) |
| **[templates/barbershop.md](templates/barbershop.md)** | Barbershop industry template — role mapping, seed data, workflow examples, onboarding |
| **[database_schema.md](database_schema.md)** | Complete Prisma schema reference (56 models) |
| **[rbac_system.md](rbac_system.md)** | 25-feature RBAC catalog, permission matrix, middleware |
| **[deployment.md](deployment.md)** | Docker deployment, Nginx, MinIO/Soketi/OneSignal setup, database backups |
| **[development_guide.md](development_guide.md)** | Dev environment, testing, conventions, verification workflow |
| **[gap_analysis.md](gap_analysis.md)** | Current open gaps, resolved summary, phase completion matrix |

### Specifications

Feature-level specifications live in `openspec/specs/<app>/<feature>/spec.md`. These define endpoints, request/response shapes, business rules, and test scenarios.

### Current Metrics

| Metric | Value |
|--------|-------|
| API Feature Modules | 30 |
| API Endpoints | 200+ |
| Admin Pages | 29 |
| Client Pages | 16 |
| Prisma Models | 56 |
| Vitest Tests | 830 (553 API / 167 admin / 110 client) |
| E2E Playwright Specs | 9 (6 admin + 3 client) |
