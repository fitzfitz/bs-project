# @tmng/saas-api

Multi-tenant SaaS API built with **Hono** + **Node.js** + **Prisma** + **PostgreSQL**.

## Quick Start

```bash
# Install dependencies (from monorepo root)
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env

# Run database migration and seed
cd apps/api
npx prisma migrate deploy
npx prisma db seed

# Start dev server (from root)
pnpm dev:api
```

The API runs on `http://localhost:8787/api` with Swagger docs at `http://localhost:8787/api/docs`.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:api` | Start dev server with hot reload (`tsx --watch`) |
| `npx prisma db seed` | Seed platform features, templates, and dev tenant |
| `npx prisma migrate reset` | Reset database and re-seed |
| `pnpm --filter @tmng/saas-api typecheck` | TypeScript type check |

## Architecture

- **Runtime:** Node.js 22 + `@hono/node-server`
- **Framework:** Hono with `@hono/zod-openapi` for typed routes and auto-generated OpenAPI docs
- **Database:** PostgreSQL via Prisma ORM (50 models, 28 enums)
- **Auth:** JWT access/refresh tokens, database-driven RBAC (`requirePermission()`), Google OAuth, platform admin auth
- **Real-time:** Soketi (Pusher-compatible) for live queue updates
- **Media:** S3/MinIO for file uploads
- **Scheduler:** `node-cron` for 8 background jobs (NO_SHOW timeout, auto clock-out, anomaly detection, point expiry, retention, referral expiry, nightly snapshots)
- **Analytics:** Global dashboard, branch comparison, peak heatmap, retention cohorts, revenue forecast, chair utilization tracking

## Deployment

Docker container deployed via GitHub Actions to VPS. See [deployment.md](../../docs/deployment.md) for full guide.

```bash
docker build -t saas-api .
docker run -p 8787:8787 --env-file .env.production saas-api
```
