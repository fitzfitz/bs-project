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
*   **Current State:** `POST /api/payments/create-charge` creates Xendit invoices. Webhook endpoint (`POST /api/payments/webhook`) validates `X-Callback-Token` and finalizes transactions. Saved payment methods: `GET/POST/DELETE /api/payments/methods` for Xendit-tokenized cards (max 5 per user). `SavedPaymentMethod` model stores tokenId, last4, expiry.
*   **Optional prepayment (Sprint 9):** When org config enables prepayment, customers can pay a deposit online for bookings; `QueueEntry` stores `prepaidAmount`, `prepaymentReference`, and `refundAmount` when cancelling with policy.

## 6b. Email Service (Transactional / Reports)
*   **Library:** `nodemailer` (Node.js SMTP transport).
*   **Purpose:** Send scheduled report bundles (PDF + CSV attachments) to configured recipients for `ReportSchedule` rows; general transactional email extensibility.
*   **Configuration:** Env vars `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. When unset, email sends degrade gracefully (logged / skipped per implementation).
*   **Note:** Password reset “forgot password” may still be a no-op email path; report scheduling is the primary SMTP consumer in Sprint 9.

## 7. Push Notifications, WhatsApp, SMS & In-App Inbox
*   **Push Provider:** OneSignal (Free tier) + in-app `Notification` model
*   **WhatsApp Provider:** Twilio WhatsApp Business API (adapter pattern in `NotificationService`)
*   **SMS Provider:** Twilio Messages API (plain text SMS via `sendSms()`)
*   **Purpose:** Multi-channel notifications — push (OneSignal), WhatsApp (Twilio), SMS (Twilio), and in-app inbox. Used for booking confirmations, queue status (CALLED/COMPLETED), appointment reminders, retention nudges, and campaigns.
*   **How it Works:** `utils/notifications.ts` exposes `sendPush()`, `sendWhatsApp()`, and `sendSms()`. Push uses OneSignal REST API v1 with `include_aliases: { external_id: [userId] }`. WhatsApp uses Twilio Messages API with template-based messaging (`ContentSid`). SMS uses the same Twilio Messages API with plain `Body` text and E.164 phone numbers. All channels gracefully degrade to structured logs when env vars are not configured.
*   **Channel Config:** Admin can toggle push/WhatsApp/SMS per notification type via `NotificationChannelConfig` model. Endpoints: `GET /api/notifications/channels`, `PUT /api/notifications/channels/:type`. Gated by `ORG_SETTINGS` permission.
*   **User Preferences:** Users can opt out of push/WhatsApp/SMS via `NotificationPreference` model. Endpoints: `GET /api/notifications/preferences`, `PUT /api/notifications/preferences`. No special permission required (user-scoped).
*   **In-App Inbox:** `GET /api/notifications` (paginated), `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`. Client bell icon shows unread count.
*   **Env vars:** `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM`

## 7b. Structured Logging & Observability
*   **Logger:** pino (JSON output in production, pino-pretty in development). Configurable via `LOG_LEVEL` env var (default: `info`).
*   **Request Correlation:** Every HTTP request gets a `X-Request-Id` header (read from client or auto-generated UUID). The ID is propagated through all pino log lines for end-to-end tracing.
*   **Health Endpoint:** `GET /api/health` returns: `success`, `status`, `message`, `timestamp`, `version`, `uptime` (seconds), `memory` (rss/heapUsed/heapTotal in MB), `db` (totalCount/idleCount/waitingCount from pg.Pool).
*   **DB Pool Tuning:** Configurable `DB_POOL_MAX` env var (default 10). Explicit warmup query (`SELECT 1`) on pool creation to prevent cold-start stampede.

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
| Every 5 min | Appointment reminders | Push notification 25-30 min before `scheduledAt` for upcoming bookings |
| Daily 03:10 UTC | Referral expiry | PENDING referrals older than 30 days → EXPIRED |
| Hourly | Report schedule processor | Due `ReportSchedule` rows (`nextRunAt` ≤ now) → generate PDF/CSV, email via SMTP, advance `nextRunAt` |
| Every 5 min | Waitlist entry expiry | `WaitlistEntry` past `expiresAt` → status EXPIRED (or equivalent cleanup) |

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
*   **Reports:** `GET /reports/generate` (5 report types), `GET /reports/export/csv`, **`GET /reports/export/pdf`** (pdfkit). **Sprint 9:** `ReportSchedule` CRUD + hourly processor (email with attachments); `SavedReportTemplate` CRUD for reusable filter sets.
*   **Config:** Org keys include `TAX_RATE`, commission template rates, and **Sprint 9** self-service: `PREPAYMENT_ENABLED`, `DEPOSIT_PERCENTAGE`, `CANCELLATION_POLICY_HOURS`, `CANCELLATION_PENALTY_PERCENTAGE`, `WAITLIST_ENABLED`, `WAITLIST_MAX_PER_SLOT`.

## 11b. Waitlist (Sprint 9)
*   **Model:** `WaitlistEntry` — org/branch scoped; links customer, preferred slot, services, optional staff; `WaitlistStatus`: WAITING, NOTIFIED, CONVERTED, EXPIRED, CANCELLED.
*   **API:** Customer and admin waitlist endpoints (join, list, manage) with RBAC; expiry enforced by scheduler every 5 minutes.
*   **Config:** `WAITLIST_ENABLED`, `WAITLIST_MAX_PER_SLOT` per organization.

## 12. Notifications Inbox API
*   **Endpoints:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`
*   **Admin Endpoints:** `GET /api/notifications/admin` (org-wide list), `GET /api/notifications/admin/stats`, `POST /api/notifications/admin/test-send`
*   **Channel Config:** `GET /api/notifications/channels`, `PUT /api/notifications/channels/:type` (admin, ORG_SETTINGS permission)
*   **User Preferences:** `GET /api/notifications/preferences`, `PUT /api/notifications/preferences` (user-scoped, no special permission)
*   **Models:** `Notification` (title, body, type, data, read status), `NotificationChannelConfig` (per notification type push/WhatsApp/SMS toggles), `NotificationPreference` (per user push/WhatsApp/SMS opt-out). All org-scoped.
*   **Client:** Bell icon with unread count badge on home page. `/notifications` page with paginated list, mark-read, mark-all-read.

## 13. Saved Payment Methods
*   **Endpoints:** `GET /api/payments/methods`, `POST /api/payments/methods`, `DELETE /api/payments/methods/:id`
*   **Model:** `SavedPaymentMethod` — stores Xendit tokenId, card last4, expiry, default flag. Max 5 per user.
*   **Client:** `/payment-methods` page with card list, add card form (Xendit.js tokenization), delete with confirmation.
