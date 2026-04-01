# TMNG SaaS Platform — OpenSpec Project Context

## Overview

Multi-tenant, industry-agnostic SaaS platform for service-based businesses with multiple branches. Originally built for barbershops, now generic. Three apps in a pnpm monorepo.

## Tech Stack

### Backend (`apps/api` — `@tmng/saas-api`)
- **Runtime:** Hono.js on Node.js 22 LTS via `@hono/node-server`
- **API Pattern:** `@hono/zod-openapi` — all routes use `createRoute()` + `app.openapi()`
- **Database:** PostgreSQL + Prisma ORM (56 models, multi-tenant)
- **Auth:** JWT access + refresh tokens, database-driven RBAC (25 features, CRUD permissions)
- **Validation:** Zod v4
- **Real-time:** Pusher HTTP API → Soketi WebSocket server
- **Reports & email:** `pdfkit` (PDF), `nodemailer` (SMTP for scheduled reports)
- **Testing:** Vitest + Hono `testClient`, Playwright E2E (CI-integrated) — **830** unit/integration tests across API (553) + admin (167) + client (110)

### Frontend — Admin (`apps/admin` — `@tmng/barber-admin`)
- **Framework:** React 19 + React Router v6, Vite v7, TypeScript strict
- **Styling:** Tailwind CSS v4 + Shadcn/ui
- **State:** TanStack Query (server), Zustand (client)
- **Forms:** react-hook-form + @hookform/resolvers/zod
- **HTTP:** Axios via `lib/api.ts` (auto Bearer token, X-Org-Slug, silent 401 refresh)
- **Testing:** Vitest + MSW + @testing-library/react
- **Other:** recharts, @dnd-kit, pusher-js, lucide-react, vite-plugin-pwa

### Frontend — Client (`apps/client` — `@tmng/barber-client`)
- **Framework:** React 19 + React Router v6, Vite v7, TypeScript strict
- **Styling:** Tailwind CSS v4 + Shadcn/ui
- **State:** TanStack Query (server), Zustand (client)
- **Forms:** react-hook-form + @hookform/resolvers/zod
- **HTTP:** Axios via `lib/api.ts` (same pattern as admin)
- **Testing:** Vitest + MSW + @testing-library/react
- **Other:** leaflet/react-leaflet, react-onesignal, date-fns, lucide-react, **i18n:** `react-i18next`, `i18next`, `i18next-browser-languagedetector` (en/id)

## Architecture Patterns

### API — 4-File Feature Module
All domain logic in `src/features/<name>/`:
1. `[name].schema.ts` — Zod schemas + `createRoute()` OpenAPI definitions
2. `[name].index.ts` — `OpenAPIHono<AppEnv>` router, middleware wiring
3. `[name].handlers.ts` — HTTP controllers
4. `[name].service.ts` — Business logic + Prisma queries (receives `db` as parameter, no globals)

### Frontend — Feature-Sliced Design
All domain logic in `src/features/<name>/`:
- `api/` — TanStack Query hooks (`use-*.ts`)
- `widgets/` — Connected page-section components
- `components/` — (optional) Pure UI components
- `store/` or `store.ts` — (optional) Zustand stores
- `types.ts` — (optional) Zod schemas & TS types

### Multi-Tenancy
- Every table scoped by `organizationId`
- Auth uses `orgSlug` to identify tenant
- `orgScopeMiddleware()` injects org-scoped Prisma
- JWT claims: `userId`, `organizationId`, `tenantRoleId`, `scope`, `branchId`

### RBAC
- Database-driven: `TenantRole` + `TenantRolePermission` (25 feature codes, CRUD flags)
- Middleware: `requirePermission(feature, action)` — NEVER use deprecated `requireRole()`
- Frontend: `<RequirePermission feature="CODE" action="canRead">` (admin only, not client)

## Naming Conventions

- Generic: `StaffProfile` not `BarberProfile`, `staff` not `barber`
- API routes: kebab-case (`/api/cash-drawer`)
- Feature dirs: kebab-case (`cash-drawer/`)
- Files: kebab-case (`use-cash-drawer.ts`)
- Hooks: `use-` prefix (`use-queue.ts`)
- Zod schemas: PascalCase (`CreateTransactionSchema`)

## API Response Envelope

```typescript
{ success: boolean; data?: T; message?: string; pagination?: { page, limit, total, totalPages } }
```

## Key Business Rules

- **Payment:** Pay at checkout **or** optional online prepayment (org: `PREPAYMENT_ENABLED`, `DEPOSIT_PERCENTAGE`). Cash, Card, QRIS, Digital Wallet via Xendit at POS; prepayment via Xendit when enabled.
- **Booking:** 10-min grace period → auto-release → late arrivals = walk-ins. **Cancellation penalties apply only to prepaid bookings**; policy hours and penalty % from org config (`CANCELLATION_POLICY_HOURS`, `CANCELLATION_PENALTY_PERCENTAGE`); refunds on `QueueEntry.refundAmount`.
- **Waitlist:** Optional (`WAITLIST_ENABLED`, `WAITLIST_MAX_PER_SLOT`); `WaitlistEntry` + expiry job (every 5 min).
- **Reporting:** CSV + PDF (`pdfkit`); scheduled email reports (`ReportSchedule`, `ReportFrequency`) via **SMTP** (`nodemailer`, env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`); saved filters (`SavedReportTemplate`).
- **i18n:** Frontend-only (admin + client); `en` + `id` namespaces — not driven by API locale negotiation.
- **Services:** Globally managed by org admin. Branches inherit, can only override price or disable.
- **Timestamps:** Store UTC, display WIB (UTC+7).
- **Currency:** Per-organization (`Organization.currency`, `currencySymbol`, `locale`). Current implementation: IDR default, but API supports any ISO 4217 currency per org.

## Source-of-Truth Docs

| Doc | Purpose |
|-----|---------|
| `docs/platform_overview.md` | Business context, architecture, tech stack, third parties, scheduler |
| `docs/features.md` | Complete feature catalog with endpoints, pages, workflows, status |
| `docs/business_logic.md` | Core business rules, state machines, pricing calculations |
| `docs/database_schema.md` | Complete Prisma schema (56 models) |
| `docs/rbac_system.md` | 25-feature permission catalog, TenantRole model |
| `docs/deployment.md` | Docker, Nginx, MinIO/Soketi/OneSignal setup, database backups |
| `docs/development_guide.md` | Dev setup, testing, conventions, verification workflow |
| `docs/gap_analysis.md` | Current open gaps, resolved summary, phase completion |
