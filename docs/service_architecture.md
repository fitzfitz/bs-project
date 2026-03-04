# TMNG SaaS Platform — Service Architecture

This document tracks all external and self-hosted services required to run the TMNG SaaS Platform. This ensures a clear understanding of the infrastructural dependencies and where each part of the system lives.

## 1. Frontend Infrastructure
*   **Provider:** Static hosting (Nginx on VPS, or any CDN/static host)
*   **Purpose:** Hosts the static React 19 SPA applications (`@tmng/barber-admin` Admin Dashboard & `@tmng/barber-client` Client PWA).
*   **Tech:** HTML/CSS/JS built with Vite and served as static files.

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

## 6. Payment Gateway (Future)
*   **Provider:** Xendit (or similar)
*   **Purpose:** Handling QRIS, Credit Card, and Virtual Account payments at Checkout (POS).

## 7. Multi-Tenancy & RBAC
*   **Model:** Single shared database with `organizationId` column on all tenant-level tables.
*   **RBAC:** Database-driven role-based access control with `TenantRole`, `TenantRolePermission`, and `Feature` tables.
*   **Scope:** Prisma `$extends` middleware auto-injects `organizationId` into queries.
*   **Platform Admin:** Separate `PlatformAdmin` table and auth flow for TMNG staff.
