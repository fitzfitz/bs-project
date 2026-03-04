# The Barber Project - Architecture & Implementation Plan

> [!IMPORTANT]
> **User Review Required: Phase 2 Plan**  
> We are starting Phase 2 (Branch Operations). Please see the **Phase 2 Proposed Changes** section below for the detailed API layout before we begin execution.

This document outlines the technical requirements, architecture, and implementation strategy for "The Barber Project" based on the provided goals and features.

## Key Decisions
- **Strict OpenAPI Architecture:** All Hono API routes *must* be constructed using `createRoute` and `OpenAPIHono` from `@hono/zod-openapi`. Manual Swagger JSON generation or standard `hono.get()` methods are strictly forbidden to ensure 100% consistent, auto-generated documentation and RPC type safety.
- **Client App:** Progressive Web App (PWA) — mobile-first, installable, offline-capable
- **Payment Model:** Pay at Checkout only (Option A) — no online prepayment. All payments processed at POS after service completion.
- **Payment Gateway:** Xendit (tentative, may change) — abstracted behind a payment adapter interface for easy swapping
- **Booking Policy:** No customer penalties. 10-minute grace period → auto-release → late arrivals treated as walk-ins.
- **WhatsApp Notifications:** Deferred — pluggable provider pattern, V1 is Push + Email only
- **Service Catalog:** Globally managed by Super Admin. Branches inherit and can only override price or disable.
- **Package Manager:** `pnpm` — all dependency installations must use `pnpm add`, never generate `package.json` entries directly.
- **Deployment:** Node.js + Docker on VPS (Hono API), Static hosting (React apps), MinIO on VPS (media storage)
- **Currency / Timezone:** IDR only, WIB (UTC+7) — store all timestamps in UTC internally
- **CLI-First Scaffolding:** Always use CLI tools to generate projects/configs when available (e.g., `pnpm create vite`, `pnpm create hono`, `npx shadcn@latest`, Tailwind v4 CLI setup). Never manually create boilerplate that a CLI can generate.
- **Strict Frontend Forms:** All frontend forms must use `react-hook-form` coupled with `@hookform/resolvers/zod`. Manual controlled state for complex forms is restricted unless absolutely necessary.
- **Unified TypeScript Contracts:** Zod must be used as the single source of truth for types on both the frontend and backend.
- **Verification Order:** Always run `lint → typecheck → test` in that order before considering a phase or feature complete.

## Proposed Architecture & Tech Stack

### 1. Frontend Architecture
Based on [react-setup.md](file:///d:/Fitz/Misc/bs-project/docs/react-setup.md) — **Feature-Based Architecture** with strict layer separation.

- **Framework:** React 19 + React Router v6 (SPA, not SSR)
- **Build Tool:** Vite v7 + Rolldown
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (config-less) + Shadcn/ui (Maia preset)
- **Server State:** TanStack Query (caching, pagination, optimistic updates)
- **Client State:** Zustand (UI state, session state)
- **Form Management:** `react-hook-form` exclusively, tightly coupled with `@hookform/resolvers/zod` for validation.
- **Testing:** Vitest + MSW (mock API handlers per feature)
- **Apps:**
  - **Client PWA** — customer-facing booking & loyalty app (mobile-first)
  - **Admin Dashboard** — branch operations, POS, barber management (desktop-first)
  - **Super Admin Dashboard** — global analytics & configuration (desktop-first)
- **Monorepo:** Shared UI components, types, and config across apps (Turborepo or npm workspaces)

### 2. Backend Architecture
Based on [hono-setup.md](file:///d:/Fitz/Misc/bs-project/docs/hono-setup.md) — **Feature-Driven Layered Architecture** with Hono Factory Pattern.

- **Runtime:** Hono.js (lightweight, edge-ready, TypeScript-native)
- **Pattern:** Feature modules with `[name].index.ts` → `[name].handlers.ts` → `[name].service.ts` → `[name].schema.ts`
- **Validation:** Zod schemas for all request/response contracts + env variables (fail-fast)
- **Type Safety:** Hono RPC type exports (`client.ts`) for end-to-end type inference between frontend and backend
- **Error Handling:** Unified error response middleware (`{ success, message }`)
- **Database:** PostgreSQL + Prisma ORM (type-safe queries, migrations)
- **Auth:** JWT-based (access + refresh tokens) with role claims, middleware-enforced RBAC
- **Real-Time:** WebSocket support (via Hono or Durable Objects) for Live Queue
- **API Docs:** Auto-generated OpenAPI via `@hono/zod-openapi`
- **Deployment:** Node.js 22 LTS + `@hono/node-server`, Docker container on VPS

### 3. Authentication & Advanced RBAC
*To support scalability, the system must have granular Role-Based Access Control (RBAC) and deep role-level tracking/monitoring.*
- **Solution:** Hono auth middleware + JWT tokens with role claims, validated via Zod schemas.
- **Hierarchical Roles:**
  - `Customer`: Books appointments, views history, manages loyalty points.
  - `Barber`: Views personal schedule, performance metrics, commissions, and manages their own profile.
  - `Cashier/Receptionist`: Manages the live queue, POS, checkout, and walk-ins.
  - `Branch Supervisor`: Oversees daily branch operations, inventory levels, and handles shift overrides or cash drawer reconciliation.
  - `Branch Manager`: Accesses localized CRM, adjusts barber configurations, views branch-level financial analytics, and manages payroll approval for the branch.
  - `Super Admin (Owner/HQ)`: Global access across all branches. Cannot directly alter a live queue, but handles high-level strategic data, financial auditing, and global service pricing.
- **Role-Level Monitoring (Audit Trails):** Every significant action (e.g., discounting a service, voiding a transaction, overriding a schedule) must be logged and tied to the specific role and User ID for security and accountability.

## Complete Feature Specification

---

### 1. Client Application (Customer-Facing)

#### 1.1. Authentication & Profile
- 1.1.1. Registration via Email/Password
- 1.1.2. OAuth Login (Google, Apple)
- 1.1.3. Phone Number Verification (OTP)
- 1.1.4. Profile Management (name, avatar, preferred branch, preferred barber)
- 1.1.5. Booking History & Receipt Archive

#### 1.2. Branch Discovery & Selection
- 1.2.1. Browse All Branches (list + map view)
- 1.2.2. Branch Detail Page (photos, services, operating hours, ratings)
- 1.2.3. "Nearest Branch" detection via Geolocation API
- 1.2.4. Save Favorite Branch

#### 1.3. Online Booking
- 1.3.1. Service Selection (haircut, shave, combo, etc.) with price display
- 1.3.2. Barber Selection (view barber profile, tier, rating) or "Any Available"
- 1.3.3. Real-Time Availability & Time Slot Picker
- 1.3.4. Estimated Wait Time (factoring live queue length)
- 1.3.5. Booking Confirmation & Push/Email Notification
- 1.3.6. Reschedule & Cancellation (free, no penalties)
- 1.3.7. 10-Minute Grace Period with auto-release on expiry
- 1.3.8. Late Arrival → auto-converted to walk-in (no penalty, no friction)

#### 1.4. Loyalty & Rewards
- 1.4.1. Points Accumulation per Transaction (configurable earn rate)
- 1.4.2. Points Redemption for Discounts or Free Services
- 1.4.3. Loyalty Tier Progression (e.g., Bronze → Silver → Gold → Platinum)
- 1.4.4. Referral Program (earn bonus points for referring new customers)
- 1.4.5. Points Balance & Transaction History

#### 1.5. Rating & Review
- 1.5.1. Post-Appointment Rating (1–5 stars for barber + branch)
- 1.5.2. Written Review with optional Photo Upload
- 1.5.3. Review Moderation (flagging inappropriate content)
- 1.5.4. Public Review Feed on Branch & Barber Profiles

#### 1.6. Notifications (V1: Push + Email)
- 1.6.1. Appointment Reminders (push, email)
- 1.6.2. Booking Status Updates (confirmed, barber ready, completed)
- 1.6.3. Promotions & Loyalty Milestone Alerts
- 1.6.4. Re-engagement Nudges ("It's been X weeks since your last visit")
- 1.6.5. *[DEFERRED]* WhatsApp/SMS integration (pluggable provider pattern ready)
- 1.6.6. **Tech Stack:** OneSignal for both unlimited Web Push Notifications and Transactional Email sends.

---

### 2. Admin Dashboard (Branch Level)

#### 2.1. Live Queue & Scheduling
- 2.1.1. Unified Live Queue Board (WebSocket-powered real-time updates)
- 2.1.2. Merge Walk-ins + Online Bookings into a single queue
- 2.1.3. Drag-and-Drop Barber Assignment to Queue Items
- 2.1.4. Queue Status Management (Waiting → In Chair → Completed)
- 2.1.5. Daily/Weekly Schedule Calendar View
- 2.1.6. Block-off Time Slots (barber breaks, meetings, training)
- 2.1.7. Overbooking Prevention & Conflict Detection

#### 2.2. Point of Sale (POS)
- 2.2.1. Service Checkout (single or bundled services)
- 2.2.2. Product Sales (retail items linked to inventory)
- 2.2.3. Multiple Payment Methods (Cash, Card, QRIS/Digital Wallet via Xendit adapter)
- 2.2.4. Tips & Gratuity Handling
- 2.2.5. Split Payment Support
- 2.2.5a. Payment Gateway Adapter (abstracted interface — Xendit default, swappable)
- 2.2.6. Discount Application (manual, loyalty points, promo codes)
- 2.2.7. Digital Receipt Generation (email; WhatsApp deferred)
- 2.2.8. Offline Mode with local transaction queue (sync on reconnect)
- 2.2.9. End-of-Day Cash Drawer Reconciliation

#### 2.3. Barber Management
- 2.3.1. Barber Profiles (photo, bio, specialties, tier level)
- 2.3.2. Barber Tiering System (Junior, Senior, Master) with per-tier pricing
- 2.3.3. Barber Shift Scheduling & Roster Management
- 2.3.4. Attendance System (Clock-in / Clock-out with timestamp + location)
- 2.3.5. Chair Utilization Rate Tracking (active cutting time vs. idle)
- 2.3.6. Leave & Day-Off Management

#### 2.4. Commission & Payroll
- 2.4.1. Configurable Commission Structures per Barber/Tier (flat %, sliding scale, base + bonus)
- 2.4.2. Automated Daily/Weekly Commission Calculation
- 2.4.3. Tips Distribution (per barber or pooled)
- 2.4.4. Payroll Summary & Export (per pay period)
- 2.4.5. Manager Approval Workflow before payroll finalization

#### 2.5. Inventory & Retail
- 2.5.1. Product Catalog Management (name, SKU, cost, sell price, photo)
- 2.5.2. Stock Level Tracking per Branch
- 2.5.3. Low-Stock Alerts & Reorder Notifications
- 2.5.4. Stock-In / Stock-Out Logging
- 2.5.5. Inventory Valuation Report (COGS tracking)

#### 2.6. Branch CRM & Marketing
- 2.6.1. Customer Database per Branch (visit frequency, preferences, spend)
- 2.6.2. Automated Retention Triggers (SMS/WhatsApp: "Time for a trim!")
- 2.6.3. Promo Code & Campaign Management (branch-specific)
- 2.6.4. Customer Segmentation (VIP, At-Risk, New, Lapsed)

#### 2.7. Branch Reporting
- 2.7.1. Daily Revenue Summary (services vs. retail breakdown)
- 2.7.2. Booking Source Analysis (online vs. walk-in ratio)
- 2.7.3. Barber Performance Leaderboard
- 2.7.4. Customer Visit Frequency Distribution
- 2.7.5. Exportable Reports (CSV, PDF)

#### 2.8. Branch Settings
- 2.8.1. Operating Hours & Holiday Calendar
- 2.8.2. Emergency Closure Toggle (auto-cancels affected bookings)
- 2.8.3. Branch Service Overrides (override base price, disable specific services for this branch)
- 2.8.4. Dynamic/Surge Pricing Rules (peak hours, weekends)

---

### 3. Super Admin Dashboard (HQ / Owner Level)

#### 3.1. Centralized Monitoring
- 3.1.1. Multi-Branch Overview Dashboard (live status of all branches)
- 3.1.2. Real-Time Revenue Ticker (aggregate + per-branch)
- 3.1.3. Active Barber Count & Utilization across all branches
- 3.1.4. Today's Booking Volume (aggregate + per-branch)
- 3.1.5. Alert Center (low inventory, attendance issues, unusual voids)

#### 3.2. Analytics & Insights
- 3.2.1. Comparative Branch Performance (revenue, ratings, customer count)
- 3.2.2. Peak Hour Heatmap (identify busiest times across branches)
- 3.2.3. Customer Retention & Churn Rate Analysis
- 3.2.4. Service Popularity Trends
- 3.2.5. Revenue Forecasting (based on historical data)
- 3.2.6. Barber Productivity Benchmarking (cross-branch)

#### 3.3. Global Service Catalog (Super Admin Owned)
- 3.3.1. **Services CRUD** — Create, edit, deactivate services (name, category, base price, duration, buffer time)
- 3.3.2. **Service Categories** — Organize services (e.g., Haircut, Shave, Treatment, Combo)
- 3.3.3. **Combo / Package Deals** — Bundle multiple services at a discounted price (e.g., "Haircut + Shave + Wash" = 120K instead of 150K)
- 3.3.4. **Add-Ons** — Optional extras attachable to any main service (e.g., Hot Towel +10K, Scalp Massage +15K, Beard Oil Treatment +20K)
- 3.3.5. **Barber Tier Surcharges** — Define per-tier price modifiers (Junior: +0, Senior: +15K, Master: +30K) applied globally
- 3.3.6. **Service Inheritance** — All branches auto-inherit the global catalog; branches can only override price or disable a service, not create new ones

#### 3.4. Global Configuration
- 3.4.1. Branch CRUD (create, edit, deactivate branches)
- 3.4.2. Loyalty Program Rules & Tier Thresholds
- 3.4.3. Global Promotion Campaigns (applied across all branches)
- 3.4.4. Commission Structure Templates

#### 3.5. User & Role Management
- 3.5.1. User Directory (all staff across branches)
- 3.5.2. Role Assignment & Permission Matrix Management
- 3.5.3. Branch-Specific Staff Assignment
- 3.5.4. Audit Log Viewer (filter by role, user, action type, branch, date)

#### 3.5. Financial Oversight
- 3.5.1. Consolidated P&L View (all branches)
- 3.5.2. Payroll Approval & Disbursement Tracking
- 3.5.3. Void & Discount Audit Report
- 3.5.4. Tax Reporting Summaries

---

### 4. RBAC Enforcement & Role-Level Monitoring

#### 4.1. Permission Matrix
| Capability | Customer | Barber | Cashier | Supervisor | Manager | Super Admin |
|---|---|---|---|---|---|---|
| Book Appointment | ✅ | — | — | — | — | — |
| View Own Schedule | — | ✅ | — | — | — | — |
| Manage Live Queue | — | — | ✅ | ✅ | ✅ | 👁️ |
| Process POS Checkout | — | — | ✅ | ✅ | ✅ | — |
| Apply Discounts | — | — | ⚠️ (limited) | ✅ | ✅ | ✅ |
| Void Transactions | — | — | — | ⚠️ (logged) | ✅ | ✅ |
| View Branch Reports | — | — | — | ✅ | ✅ | ✅ |
| Manage Barbers | — | — | — | — | ✅ | ✅ |
| Approve Payroll | — | — | — | — | ✅ | ✅ |
| Manage Inventory | — | — | — | ✅ | ✅ | ✅ |
| Cross-Branch Analytics | — | — | — | — | — | ✅ |
| Role & User Management | — | — | — | — | — | ✅ |
| View Audit Logs | — | — | — | — | ✅ (own branch) | ✅ (all) |

#### 4.2. Audit Trail System
- 4.2.1. Log all state-changing actions with: `timestamp`, `userId`, `role`, `branchId`, `action`, `details`, `ipAddress`
- 4.2.2. Immutable audit log (append-only, no deletions)
- 4.2.3. Filterable Audit Log Viewer (by role, user, action, branch, date range)
- 4.2.4. Anomaly Flagging (e.g., excessive voids, off-hours clock-ins)

---

### 5. Cross-Cutting / Platform Concerns

#### 5.1. Real-Time Infrastructure
- WebSocket server for Live Queue, booking status, and dashboard updates

#### 5.2. Notification Service
- Unified notification engine with pluggable provider pattern
- **V1 Providers:** OneSignal (Handles both Web Push Notifications via Service Worker and Transactional Email delivery).
- **Future Providers:** WhatsApp, SMS (plug in when cost-effective solution found)

#### 5.3. Offline Support
- Service Worker / PWA with IndexedDB caching for POS and queue operations

#### 5.4. File & Media Management
- MinIO (S3-compatible, self-hosted on VPS) for barber photos, branch images, review photos

#### 5.5. API Design
- RESTful API with consistent error handling, pagination, and rate limiting
- API versioning for future-proofing

#### 5.6. Security
- HTTPS everywhere, JWT access + refresh token rotation, CSRF protection
- Input sanitization and SQL injection prevention (handled by Prisma)
- Rate limiting on auth endpoints

#### 5.7. Deployment & DevOps
- **Frontend:** Static hosting (Nginx on VPS, or any CDN)
- **Backend:** Node.js + Docker on VPS (Hono + `@hono/node-server`), deployed via GitHub Actions CI/CD to GHCR
- **Media:** MinIO (S3-compatible, self-hosted on VPS via Docker)
- **Database:** PostgreSQL (self-hosted on the same VPS for sub-millisecond latency)
- **CI/CD:** GitHub Actions — lint, test, build, deploy on push
- **Environments:** dev / staging / production with Zod-validated env vars
- **DB Backups:** Automated daily PostgreSQL backups with point-in-time recovery

#### 5.8. Monitoring & Logging
- Error tracking (Sentry for Node.js)
- Structured logging for audit trail and debugging

---

## Phase 2 Proposed Changes
We will build the following feature modules in `apps/api/src/features/`:

### 1. Branch Settings API (`features/branches/`)
- **Schema & Handlers:** CRUD for branches, `OperatingHour` management, and `BranchServiceOverride` (overriding price or disabling global services natively).
- **RBAC:** Super Admin (Global CRUD), Manager (Branch Settings).
- **OpenAPI:** Documented endpoints for branch discovery.

### 2. Barber Management API (`features/barbers/`)
- **Schema & Handlers:** `BarberProfile` CRUD, associating User accounts with Barber profiles, tier management (Junior, Senior, Master).
- **RBAC:** Manager, Super Admin.

### 3. Attendance & Leaves API (`features/attendance/`)
- **Schema & Handlers:** Clock-in/out logic for `BarberAttendance` including `locationLat/Lng`, and managing `ShiftSchedule` (blocks/leaves).
- **RBAC:** Barber (Clock-in/out), Supervisor/Manager (Override/Approval).

### 4. Queue & Scheduling API (`features/queue/`)
- **Schema & Handlers:** `QueueEntry` and `Booking` creation, merging walk-ins with online bookings, and state machine transitions (Waiting → In Chair → Completed).
- **WebSocket (Soketi on VPS):** The real-time queue board will be powered by [Soketi](https://docs.soketi.app/), an open-source Pusher-compatible WebSocket server hosted on the client's Docker VPS. 
  - *Requirements:* 
    1. Deploy Soketi container to VPS (`docker run queue-soketi`).
    2. API service layer fires Pusher HTTP broadcasts to Soketi on queue/booking mutations.
    3. Frontend (Admin/Client App) connects directly to the Soketi VPS using `pusher-js` to listen for `QUEUE_UPDATED` events.
- **RBAC:** Cashier, Supervisor, Manager.

## Phase 2 Verification Plan
### Automated Tests
- Run `pnpm typecheck` and `pnpm lint` across the monorepo.
- `curl` tests against the dev server for all new CRUD endpoints to verify RBAC protection.
### Manual Verification
- View the generated Swagger UI at `/api/docs` to visually confirm new routes.
- Test the WebSocket endpoint using a WS client (e.g. wscat) to receive live queue updates.

---

## Implementation Phases

### Phase 1: Foundation
> Project scaffolding, database schema, auth + RBAC, API skeleton

| What | Features Covered |
|---|---|
| Project Setup | Monorepo, Vite v7 + React 19 apps (client PWA + admin), Hono.js on Node.js (Docker), shared packages |
| Database | PostgreSQL + Prisma schema for all entities + seed scripts (roles, permissions, Super Admin, default categories) |
| Auth + RBAC | JWT access/refresh tokens with Hono middleware, 6-role permission matrix, Zod-validated schemas |
| API Skeleton | Hono feature modules (Factory Pattern), unified error handling, rate limiting, OpenAPI docs via `@hono/zod-openapi` |
| Global Service Catalog | Services CRUD, categories, combos, add-ons, tier surcharges (3.3) |
| CI/CD & Environments | GitHub Actions pipeline, dev/staging/prod env config, Docker image to GHCR + VPS deploy via SSH |
| DB Backups | Automated daily PostgreSQL backups with point-in-time recovery |

---

### Phase 2: Branch Operations
> The operational backbone — what branch staff uses every day
> **Depends on:** Phase 1 (auth, schema, services)

| What | Features Covered |
|---|---|
| Live Queue | Unified queue board, walk-in + booking merge, state machine, WebSocket (2.1) |
| Barber Management | Profiles, tiering, shift scheduling, leave management (2.3) |
| Barber Portal | Lightweight RBAC-gated view: personal schedule, earnings, clock-in (gap #7) |
| Attendance | Clock-in/out, utilization tracking (2.3.4, 2.3.5) |
| Scheduling | Calendar view, block-off slots, conflict detection (2.1.5–2.1.7) |
| Branch Settings | Operating hours, emergency closure, service overrides, surge pricing (2.8) |
| Error Monitoring | Sentry for Node.js integration (gap #5) |

---

### Phase 3: Client Application
> The customer-facing PWA
> **Depends on:** Phase 2 (queue + scheduling APIs must exist)

| What | Features Covered |
|---|---|
| Booking Flow | Service/barber selection, real-time slots, grace period logic (1.3) |
| Branch Discovery | List + map view, geolocation, favorites (1.2) |
| User Profiles | Registration, OAuth, profile management, booking history (1.1) |
| Notifications | Push + email reminders, booking status updates, permission handling (1.6) |
| PWA Shell | Installable, Service Worker, offline awareness, install prompt (gap #23) |
| Legal Pages | Terms of Service, Privacy Policy (static pages) (gap #18) |
| Account Deletion | "Delete My Account" flow — anonymize/remove customer data (gap #19) |

---

### Phase 4: Financial & Workforce
> Money handling — POS, commissions, inventory
> **Depends on:** Phase 2 (transactions linked to queue completions)

| What | Features Covered |
|---|---|
| POS | Checkout, payment methods, tips, discounts, receipts, offline mode (2.2) |
| Offline UX | "Offline Mode" banner, sync status indicator, IndexedDB queue (gap #15) |
| Print Support | Browser print CSS for receipts and reports (gap #12) |
| Commission Engine | 3 models, daily auto-calculation, tips distribution (2.4) |
| Payroll | Summary, export, manager approval workflow (2.4.4–2.4.5) |
| Inventory | Product catalog, stock tracking, low-stock alerts, COGS (2.5) |
| Xendit Integration | Payment adapter interface, QRIS/card processing (2.2.3, 2.2.5a) |

---

### Phase 5: Loyalty & Engagement
> Customer retention features
> **Depends on:** Phase 3 (customer app) + Phase 4 (POS for point earning)

| What | Features Covered |
|---|---|
| Loyalty Points | Earn/redeem rules, tier progression, point expiry (1.4) |
| Referral Program | Bonus points for referrals (1.4.4) |
| Rating & Reviews | Post-appointment reviews, moderation, public feed (1.5) |
| Branch CRM | Customer database, segmentation, promo codes (2.6) |
| Retention Triggers | Re-engagement nudges, email campaigns (2.6.2) |

---

### Phase 6: Super Admin & Analytics
> HQ-level oversight and intelligence
> **Depends on:** All previous phases (aggregates data from everything)

| What | Features Covered |
|---|---|
| Global Dashboard | Multi-branch overview, real-time revenue, alert center (3.1) |
| Analytics | Branch comparison, peak heatmap, retention analysis, forecasting (3.2) |
| Reports | Branch reporting, barber leaderboard, exportable CSV/PDF (2.7) |
| User Management | Staff directory, role assignment, branch assignment (3.5) |
| Audit Logs | Full audit log viewer, anomaly flagging (3.5, 4.2) |
| Financial Oversight | Consolidated P&L, payroll tracking, void/discount audit (3.6) |

---

### Phase 7: SaaS Platform Refactor
> Multi-tenant, industry-agnostic headless SaaS transformation
> **Depends on:** All previous phases (complete codebase is being restructured)
> **Detailed sprint doc:** [saas_refactor_sprint.md](saas_refactor_sprint.md)

| What | Features Covered |
|---|---|
| Database Schema | New multi-tenant schema with `organizationId` on all tables, RBAC models (`TenantRole`, `TenantRolePermission`, `Feature`), generic naming (`StaffProfile` replaces `BarberProfile`) |
| RBAC Middleware | `requirePermission()` replaces `requireRole()`, org-scoped Prisma extension, branch-scoped filters, LRU permission cache |
| Feature Refactor | All 26 API feature files updated for RBAC, generic naming, org-scoped queries |
| Auth Refactor | Org-specific login via `orgSlug`, new JWT claims (`organizationId`, `tenantRoleId`, `scope`), Google OAuth for customers, platform admin auth |
| Platform Admin | Org CRUD, industry template management, feature catalog, separate auth flow |
| Role Management | Tenant role CRUD, CRUD permission matrix editor, service-to-role assignment |
| Seed Data | Platform-level seeds (25 features, 4 industry templates, platform admin), barbershop dev seed (org, roles, users, services) |
| Frontend Types | Rename `barber` → `staff` in TS types/hooks/API calls, update auth stores for `tenantRole`, add `orgSlug` to login |
| DevOps | Package rename to `@tmng/*` namespace, Docker/CI/deploy updates |
| Documentation | Update all existing docs for new naming and architecture |

**Architecture docs (source of truth):**
- [platform_architecture.md](platform_architecture.md) — Platform vision, multi-tenancy, user model
- [rbac_system.md](rbac_system.md) — 25-feature RBAC catalog, permission matrix, middleware
- [database_schema.md](database_schema.md) — Complete target Prisma schema (46 models)
