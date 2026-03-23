# TMNG SaaS Platform — Service Architecture

This document tracks all external and self-hosted services required to run the TMNG SaaS Platform. This ensures a clear understanding of the infrastructural dependencies and where each part of the system lives.

## 1. Frontend Infrastructure
*   **Provider:** Static hosting (Nginx on VPS, or any CDN/static host)
*   **Purpose:** Hosts the static React 19 SPA applications (`@tmng/barber-admin` Admin Dashboard & `@tmng/barber-client` Client PWA).
*   **Tech:** HTML/CSS/JS built with Vite and served as static files.
*   **PWA:** Both frontend apps use `vite-plugin-pwa` with Workbox for service worker caching, offline support, and installability.

## 2. API Server (Backend)
*   **Provider:** Self-Hosted VPS (Docker)
*   **Purpose:** Runs the Node.js/Hono REST API (`@tmng/saas-api`). Handles all business logic, database queries, and authentication.
*   **Tech:** `Hono.js` on `@hono/node-server` (Node.js 22 LTS), deployed as a Docker container.
*   **Port:** `8787` (behind Nginx reverse proxy)
*   **CI/CD:** GitHub Actions builds and pushes the Docker image to GHCR, then deploys via SSH.
*   **Cost:** Covered by your existing VPS cost.

## 3. Real-Time WebSockets
*   **Provider:** Self-Hosted VPS (Docker)
*   **Service Name:** Soketi (Pusher Protocol Compatible)
*   **Purpose:** Keeps the Live Queue board updated in real-time across all browser clients without them needing to refresh the page.
*   **How it Works:** The API server sends an HTTP POST request to Soketi whenever the database changes. Soketi then broadcasts that change to the React frontend via a persistent WebSocket connection.
*   **Cost:** Covered by your existing VPS cost. (Zero additional SaaS fees).
*   **Docker Command:** `docker run -p 6001:6001 quay.io/soketi/soketi`

## 4. Database
*   **Provider:** PostgreSQL (Self-Hosted on VPS)
*   **Purpose:** Stores all persistent data (Organizations, Users, Branches, Staff, Queue, Transactions).
*   **Tech:** Accessed by the API server using the Prisma ORM with the `@prisma/adapter-pg` driver adapter and `pg.Pool` for connection pooling. Running on the same VPS as the API for sub-millisecond latency.

## 5. Media Storage
*   **Provider:** Self-Hosted VPS (Docker)
*   **Service Name:** MinIO (S3-Compatible Object Storage)
*   **Purpose:** Storing user avatars, staff photos, branch images, product photos, and review photos.
*   **How it Works:** The API server uploads files to MinIO via the S3-compatible API. Frontend reads images directly from the MinIO public URL.
*   **Cost:** Covered by your existing VPS cost. (Zero additional SaaS fees).
*   **Setup Guide:** See [minio_server_setup.md](./minio_server_setup.md)

## 6. Payment Gateway
*   **Provider:** Xendit
*   **Purpose:** Handling QRIS, Credit Card, and Virtual Account payments at Checkout (POS).
*   **Current State:** `xendit-adapter.ts` implements `createCharge()` and `checkStatus()` using the Xendit Invoices API. Webhook endpoint (`POST /api/payments/webhook`) validates `X-Callback-Token` and finalizes transactions. Charge creation route not yet exposed as an API endpoint.

## 7. Push Notifications
*   **Provider:** OneSignal (Free tier)
*   **Purpose:** Server-side push notifications to customers (retention nudges, booking reminders).
*   **How it Works:** `utils/notifications.ts` calls OneSignal REST API v1 with `include_aliases: { external_id: [userId] }`. Client app registers via `react-onesignal` and binds external user ID. Falls back to console.log when env vars not configured.
*   **Env vars:** `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`

## 8. Scheduler (Background Jobs)
*   **Tech:** `node-cron` running in the API process (`src/scheduler.ts`)
*   **Purpose:** Automated background tasks for queue management, staff operations, loyalty, retention, and analytics.

| Schedule | Job | Description |
|----------|-----|-------------|
| Every 5 min | NO_SHOW timeout | CALLED entries older than 5 min → NO_SHOW |
| Every 5 min | Grace period release | Late online bookings (10 min past scheduled) → NO_SHOW, release staff |
| Every 15 min | Auto clock-out | Staff still clocked in after branch close → auto clock-out |
| Every 15 min | Anomaly detection | Flag excessive voids, high discounts, off-hours clock-ins |
| Daily 02:00 UTC | Nightly snapshots | Compute BranchDailySnapshot for previous day |
| Daily 03:00 UTC | Point expiry | Expire loyalty points past expiration date |
| Daily 03:05 UTC | Retention triggers | At-risk and expiry nudges via OneSignal push |
| Daily 03:10 UTC | Referral expiry | PENDING referrals older than 30 days → EXPIRED |

## 9. Multi-Tenancy & RBAC
*   **Model:** Single shared database with `organizationId` column on all tenant-level tables.
*   **RBAC:** Database-driven role-based access control with `TenantRole`, `TenantRolePermission`, and `Feature` tables. 25 feature codes with CRUD permissions. LRU cache (5-min TTL) for permission lookups.
*   **Scope:** `scopeToOrg()` and `scopeToBranch()` middleware auto-injects `organizationId`/`branchId` into Prisma queries.
*   **Platform Admin:** Separate `PlatformAdmin` table and auth flow for TMNG staff.

## 10. CI/CD & Deployment
*   **CI:** GitHub Actions (`ci.yml`) — runs lint + typecheck on push/PR to main.
*   **API Deployment:** GitHub Actions (`deploy-api.yml`) — builds Docker image, pushes to GHCR, deploys to VPS via SSH. Triggered on push to main when `apps/api/**` or `pnpm-lock.yaml` changes.
*   **Frontend Deployment:** Static build via `pnpm build`, served by Nginx on VPS or any static host.
*   **Database Backups:** `scripts/backup-db.sh` (pg_dump + gzip, 7-day retention), daily cron at 02:00.

## 11. Analytics & Reporting
*   **Analytics API:** `GET /analytics/dashboard`, `GET /analytics/comparison`, `GET /analytics/heatmap`, `GET /analytics/retention`, `GET /analytics/forecast`, `GET /analytics/utilization` (per-barber cutting time vs available time), `POST /analytics/snapshots/compute`.
*   **Reports:** `GET /reports/generate` (5 report types), `GET /reports/export/csv`.
*   **Config:** 11 configurable keys including `TAX_RATE`, `COMMISSION_RATE_MASTER`, `COMMISSION_RATE_SENIOR`, `COMMISSION_RATE_JUNIOR`.
