# TMNG SaaS Platform

Multi-tenant SaaS platform for service-based businesses (barbershops, salons, spas, clinics). Manages bookings, queue, POS, commissions, payroll, inventory, loyalty, CRM, and analytics across multiple branches and organizations.

## Architecture

| Component | Tech | Port |
|-----------|------|------|
| **API** (`@tmng/saas-api`) | Hono + Node.js 22, Prisma, PostgreSQL | 8787 |
| **Admin** (`@tmng/barber-admin`) | React 19, Vite 7, Tailwind CSS 4 | 5175 |
| **Client** (`@tmng/barber-client`) | React 19, Vite 7, PWA | 5174 |

**Infrastructure:** PostgreSQL, MinIO (S3-compatible media), Soketi (WebSocket), OneSignal (push), Xendit (payments)

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 15+

### Setup

```bash
# Clone and install
git clone <repo-url> && cd bs-project
pnpm install

# Configure environment
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/admin/.env.example apps/admin/.env
cp apps/client/.env.example apps/client/.env
# Edit .dev.vars with your DATABASE_URL and JWT_SECRET

# Database setup
cd apps/api
npx prisma migrate deploy
npx prisma db seed
cd ../..

# Start all apps
pnpm dev:api     # API on http://localhost:8787
pnpm dev:admin   # Admin on http://localhost:5175
pnpm dev:client  # Client on http://localhost:5174
```

### Seeded Test Accounts

All passwords: `Password123!`

| Email | Role | Org |
|-------|------|-----|
| admin@tmng.dev | Platform Admin | (platform) |
| owner@barber.com | Owner | budis-barbershop |
| manager@barber.com | Manager | budis-barbershop |
| cashier@barber.com | Cashier | budis-barbershop |
| budi@barber.com | Barber (Master) | budis-barbershop |
| customer1@gmail.com | Customer | budis-barbershop |

## Project Structure

```
bs-project/
├── apps/
│   ├── api/          # Hono API (29 feature modules, 176 endpoints)
│   ├── admin/        # Admin dashboard (23 pages)
│   └── client/       # Customer PWA (14 pages)
├── docs/             # Architecture docs, sprint plans, setup guides
├── scripts/          # DB backup/restore, test runner
└── .github/workflows # CI (lint + typecheck), API deploy (Docker → VPS)
```

## Key Documentation

| Document | Description |
|----------|-------------|
| [implementation_plan.md](docs/implementation_plan.md) | Architecture, feature spec, 7-phase plan |
| [database_schema.md](docs/database_schema.md) | Complete Prisma schema reference (46 models) |
| [rbac_system.md](docs/rbac_system.md) | 25-feature RBAC catalog and permission matrix |
| [platform_architecture.md](docs/platform_architecture.md) | Multi-tenancy model and user flows |
| [business_logic.md](docs/business_logic.md) | Core business rules and formulas |
| [gap_analysis.md](docs/gap_analysis.md) | Feature gap tracking |
| [audit_report.md](docs/audit_report.md) | System audit and feature status |
| [deployment.md](docs/deployment.md) | Docker, Nginx, CI/CD, backup guide |
| [service_architecture.md](docs/service_architecture.md) | External services overview |

## Scripts

```bash
pnpm dev:api          # Start API dev server
pnpm dev:admin        # Start admin dev server
pnpm dev:client       # Start client dev server
pnpm lint             # Lint all apps
pnpm typecheck        # Type check all apps
pnpm verify           # lint + typecheck + test
pnpm build            # Build all apps
```

## API Documentation

Swagger UI is available at `http://localhost:8787/api/docs` when the API is running. OpenAPI spec at `/api/openapi.json`.
