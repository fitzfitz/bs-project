# TMNG SaaS Platform

Headless, multi-tenant SaaS engine for appointment-based service businesses. The same API powers barbershops, vet clinics, salons, spas, and any business that takes appointments, manages staff, and processes payments. Each frontend is a themed "skin" for a specific industry.

## Architecture

| Component | Tech | Port |
|-----------|------|------|
| **API** (`@tmng/saas-api`) | Hono.js + Node.js 22, Prisma, PostgreSQL | 8787 |
| **Admin** (`@tmng/barber-admin`) | React 19, Vite 7, Tailwind CSS 4 | 5175 |
| **Client** (`@tmng/barber-client`) | React 19, Vite 7, PWA | 5174 |

**Infrastructure:** PostgreSQL (56 models), MinIO (media), Soketi (WebSocket), OneSignal (push), Resend (transactional email), Twilio (WhatsApp/SMS), Xendit (payments), nodemailer (SMTP for reports)

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd bs-project
pnpm install

# Configure environment
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Edit .dev.vars with DATABASE_URL and JWT_SECRET (min 32 chars)

# Database setup
pnpm --filter @tmng/saas-api db:push
pnpm --filter @tmng/saas-api db:seed

# Start all apps
pnpm dev:api     # API on http://localhost:8787
pnpm dev:admin   # Admin on http://localhost:5175
pnpm dev:client  # Client on http://localhost:5174
```

API docs at `http://localhost:8787/api/docs` (Swagger UI).

### Seeded Test Accounts

All passwords: `Password123!`

| Email | Role | Org |
|-------|------|-----|
| admin@tmng.dev | Platform Admin | (platform) |
| owner@barber.com | Owner (HQ) | budis-barbershop |
| manager@barber.com | Manager (Branch) | budis-barbershop |
| cashier@barber.com | Cashier (Branch) | budis-barbershop |
| budi@barber.com | Barber (Master) | budis-barbershop |
| customer1@gmail.com | Customer | budis-barbershop |

## Project Structure

```
bs-project/
├── apps/
│   ├── api/          # Hono REST API — 30 feature modules, 200+ endpoints
│   ├── admin/        # Admin dashboard — 29 pages, desktop-first
│   └── client/       # Customer PWA — 16 pages, mobile-first
├── packages/
│   └── email-templates/ # Shared HTML email templates (confirmed, cancelled, rescheduled, receipts)
├── docs/             # Architecture & documentation (8 core docs)
├── openspec/         # Feature specifications (spec.md per feature)
├── scripts/          # DB backup/restore, test runner
└── .github/workflows # CI (lint + typecheck + test), Docker deploy
```

## Documentation

> **New to this codebase?** Start with [platform_overview.md](docs/platform_overview.md).

| Document | Description |
|----------|-------------|
| **[platform_overview.md](docs/platform_overview.md)** | Start here — business context, architecture, tech stack, third parties, scheduler |
| **[features.md](docs/features.md)** | Complete feature catalog — all API endpoints, admin/client pages, workflows |
| **[business_logic.md](docs/business_logic.md)** | Core business rules (22 domains), state machines, pricing formulas, commission models |
| **[templates/barbershop.md](docs/templates/barbershop.md)** | Barbershop industry template — role mapping, seed data, workflow examples, onboarding |
| **[database_schema.md](docs/database_schema.md)** | Complete Prisma schema reference (56 models) |
| **[rbac_system.md](docs/rbac_system.md)** | 25-feature RBAC catalog, permission matrix, middleware |
| **[deployment.md](docs/deployment.md)** | Docker, Nginx, MinIO/Soketi/OneSignal/Twilio setup, backups |
| **[development_guide.md](docs/development_guide.md)** | Dev environment, testing, conventions, verification workflow |
| **[gap_analysis.md](docs/gap_analysis.md)** | Current open gaps, resolved summary, phase completion |

Industry templates are in `docs/templates/`. Historical/completed docs are in `docs/archive/`.

## Commands

```bash
# Development
pnpm dev:api              # Start API
pnpm dev:admin            # Start admin
pnpm dev:client           # Start client

# Verification
pnpm --filter <app> lint       # ESLint
pnpm --filter <app> typecheck  # TypeScript
pnpm --filter <app> test       # Vitest
pnpm verify                    # All of the above for all apps

# Testing
pnpm test                 # Vitest across all apps (830 tests)
pnpm test:e2e             # Playwright E2E (9 specs)
```

## Current Metrics

| Metric | Value |
|--------|-------|
| API Feature Modules | 30 |
| API Endpoints | 200+ |
| Admin Pages | 29 |
| Client Pages | 16 |
| Prisma Models | 56 |
| Vitest Tests | 830 (553 API / 167 admin / 110 client) |
| E2E Playwright Specs | 9 |
| Languages | English + Indonesian (i18n) |
