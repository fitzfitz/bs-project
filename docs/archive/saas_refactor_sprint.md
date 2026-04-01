# Phase 7: SaaS Platform Refactor Sprint

> **Last Updated:** 2026-03-03
> **Depends on:** Phase 6 (Super Admin & Analytics) — complete
> **Goal:** Transform the single-tenant barbershop app into a multi-tenant, industry-agnostic headless SaaS platform with database-driven RBAC.

---

## Progress Summary

| Phase | Description | Status | Last Updated |
|-------|-------------|--------|--------------|
| Pre-Flight | Prerequisites & setup | COMPLETE | 2026-03-03 |
| 7A | Database Schema Refactor | COMPLETE | 2026-03-03 |
| 7B-1 | New RBAC Middleware | COMPLETE | 2026-03-03 |
| 7B-2 | Refactor 26 Feature Files | COMPLETE | 2026-03-03 |
| 7B-3 | Auth Refactor | COMPLETE | 2026-03-03 |
| 7B-4 | Platform Admin Endpoints | COMPLETE | 2026-03-03 |
| 7B-5 | Tenant Role Management | COMPLETE | 2026-03-03 |
| 7C | Seed Data | COMPLETE | 2026-03-03 |
| 7D | Frontend Type Updates | COMPLETE | 2026-03-03 |
| 7E | DevOps & Package Rename | COMPLETE | 2026-03-03 |
| 7F | Documentation Update | COMPLETE | 2026-03-03 |

---

## Architecture References (Source of Truth)

These docs define the **design**; this sprint doc tracks **execution**.

- [platform_architecture.md](platform_architecture.md) — Platform vision, multi-tenancy model, user model, login flow, org settings, namespaces
- [rbac_system.md](rbac_system.md) — 25-feature catalog, permission matrix, role templates, `requirePermission()` middleware design
- [database_schema.md](database_schema.md) — Complete target Prisma schema (50 models, all enums, fields, relations, ER diagrams, indexes)

---

## Prerequisites (Pre-Flight Checklist)

Everything that must be in place **before writing a single line of refactor code**.

### 1. Environment & Tooling

- [ ] **Node.js 22** installed (required by CI and project config)
- [ ] **pnpm 10.15.0** installed (exact version from `packageManager` in root `package.json`)
- [ ] **PostgreSQL** accessible (local or remote; current `.env` points to `57.128.251.45:5432`)
- [ ] **Pusher/Soketi** credentials ready — required by `apps/api/src/utils/env.ts` (fields are `.min(1)`, not optional)

### 2. Git Initialization

The workspace is **not currently a git repo**. Initialize before starting so we have rollback points.

```bash
cd D:\Fitz\Misc\bs-project
git init
git add .
git commit -m "Pre-refactor snapshot: Phases 1-6 complete"
```

Then create a feature branch:

```bash
git checkout -b feat/saas-refactor
```

- [ ] Git repo initialized with pre-refactor snapshot commit
- [ ] Feature branch `feat/saas-refactor` created

### 3. Environment Variables

Current `apps/api/.env` is missing Pusher vars that `env.ts` requires. Ensure all required vars are set:

**Required (API will not start without these):**

| Variable | Description | Current State |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | Present |
| `JWT_SECRET` | Min 32 chars | Present |
| `JWT_REFRESH_SECRET` | Min 32 chars | Present |
| `JWT_ACCESS_EXPIRY` | Default `15m` | Present |
| `JWT_REFRESH_EXPIRY` | Default `7d` | Present |
| `NODE_ENV` | `development` or `production` | Present |
| `PUSHER_APP_ID` | Soketi/Pusher app ID | **MISSING from .env** |
| `PUSHER_KEY` | Soketi/Pusher key | **MISSING from .env** |
| `PUSHER_SECRET` | Soketi/Pusher secret | **MISSING from .env** |
| `PUSHER_HOST` | Soketi/Pusher host | **MISSING from .env** |
| `PUSHER_PORT` | Default `443` | **MISSING from .env** |
| `PUSHER_USE_TLS` | `true` or `false` | **MISSING from .env** |
| `PUSHER_CLUSTER` | Default `mt1` | **MISSING from .env** |

**Optional (gracefully degraded when absent):**

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` | MinIO/S3 for media uploads |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Push notifications |
| `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` | Payment gateway |

**No new env vars** are needed for the refactor itself (Phases 7A-7C). The refactor is structural.

- [ ] All required env vars present in `apps/api/.env`
- [ ] `apps/api/.env.example` updated with all vars (see Phase 7E task)

### 4. Verify Current State Compiles

Before touching anything, confirm the existing codebase is healthy:

```bash
pnpm install
pnpm --filter @tmng/saas-api typecheck
pnpm --filter @tmng/barber-admin typecheck
pnpm --filter @tmng/barber-client typecheck
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

- [ ] `pnpm install` succeeds
- [ ] All three apps pass typecheck
- [ ] `prisma generate` succeeds

### 5. Database Backup (Optional but Recommended)

Even though we're doing a clean wipe, save a dump for safety:

```bash
pg_dump $DATABASE_URL > backup_pre_refactor_$(date +%Y%m%d).sql
```

- [ ] Database backup saved (or consciously skipped)

---

## Database Migration Strategy: Clean Wipe + Reset Migrations

No production data to preserve. We start fresh.

### Step 1: Delete All Existing Migrations

Current migrations (3 files):

```
apps/api/prisma/migrations/
  20260222022628_init/
  20260226051525_sync_schema_with_promo_codes/
  20260226123631_add_void_reversal_stock_movement_type/
  migration_lock.toml
```

```bash
rm -rf apps/api/prisma/migrations/
```

### Step 2: Write New Schema, Then Create Baseline Migration

After completing Phase 7A (new `schema.prisma`):

```bash
cd apps/api
npx prisma migrate dev --name saas_platform_init
```

This will:
1. Drop all existing tables (since schema has changed drastically)
2. Create a single `migrations/YYYYMMDD_saas_platform_init/migration.sql` with the entire new schema
3. Run `prisma generate` to update the Prisma Client types

### Step 3: Seed Fresh Data

After completing Phase 7C (new `seed.ts`):

```bash
npx prisma db seed
```

### Verification

```bash
npx prisma migrate status          # 1 applied migration
npx prisma generate                # clean
pnpm --filter @tmng/saas-api typecheck # passes with new schema types
```

---

## Phase 7A: Database Schema Refactor

> **Why first:** Every other phase depends on the new models and `organizationId` columns.

### Files Changed

| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Complete rewrite per [database_schema.md](database_schema.md) |
| `apps/api/prisma/migrations/` | Delete all existing, recreate single baseline |

### Enum Changes

- [ ] REMOVE `Role` enum (replaced by `TenantRole` table)
- [ ] RENAME `BarberTier` → `StaffTier` (same values: JUNIOR, SENIOR, MASTER)
- [ ] RENAME `BarberStatus` → `StaffStatus` (same values: AVAILABLE, BUSY, ON_BREAK, RESERVED, OFF_DUTY)
- [ ] RENAME `LoyaltyTier` → `LoyaltyTierLevel` (same values: BRONZE, SILVER, GOLD, PLATINUM)
- [ ] RENAME VALUE `TipDistribution.PER_BARBER` → `PER_STAFF`
- [ ] RENAME VALUE `QueueStatus.IN_CHAIR` → `IN_SERVICE`
- [ ] ADD `PlatformRole` (PLATFORM_ADMIN, PLATFORM_SUPPORT)
- [ ] ADD `IndustryType` (BARBERSHOP, VET_CLINIC, MASSAGE, NAIL_SALON, SPA, PET_GROOMING, DENTAL_CLINIC, AUTO_DETAILING, BEAUTY_SALON, TATTOO_PARLOR, GENERAL_SERVICE)
- [ ] ADD `FeatureModule` (CORE, OPS, FINANCE, INTEL, ENGAGE, ADMIN)
- [ ] ADD `RoleScope` (HQ, BRANCH, CUSTOMER)
- [ ] ADD `AuthProvider` (EMAIL, GOOGLE)
- [ ] ADD `ReferralStatus` (PENDING, COMPLETED, EXPIRED)
- [ ] ADD `CampaignType` (EMAIL, PUSH, IN_APP)
- [ ] ADD `CampaignStatus` (DRAFT, SCHEDULED, ACTIVE, COMPLETED, CANCELLED)
- [ ] ADD `AnomalyType` (EXCESSIVE_VOIDS, HIGH_DISCOUNT, OFF_HOURS_CLOCKIN, UNUSUAL_REFUND, INVENTORY_DISCREPANCY)
- [ ] ADD `AnomSeverity` (LOW, MEDIUM, HIGH, CRITICAL)
- [ ] EXTEND `AuditAction` with: EARN_POINTS, REDEEM_POINTS, TIER_UPGRADE, REFERRAL_REWARD, MODERATE_REVIEW, CREATE_CAMPAIGN, EMERGENCY_CLOSURE, BRANCH_REOPENED, ASSIGN_ROLE, REMOVE_ROLE, DEACTIVATE_USER, BRANCH_ASSIGNMENT, ANOMALY_FLAGGED

### New Models (18)

- [ ] `PlatformAdmin` — platform-level, no `organizationId`
- [ ] `Feature` — platform-level, 25 feature records
- [ ] `IndustryTemplate` — platform-level, 4+ industry templates
- [ ] `PlatformConfig` — platform-level, key-value settings
- [ ] `Organization` — tenant entity with tax/currency/business/loyalty settings
- [ ] `TenantRole` — per-org configurable roles with `scope` and `isServiceProvider`
- [ ] `TenantRolePermission` — CRUD permission matrix per role per feature
- [ ] `TenantRoleService` — service-to-role assignment for service providers
- [ ] `CustomerMembership` — replaces `LoyaltyAccount`, per user per org
- [ ] `BranchHoliday` — branch-level holiday closures
- [ ] `CashDrawerSession` — cash drawer open/close tracking
- [ ] `CashDrawerEntry` — individual cash drawer entries
- [ ] `Referral` — referral tracking between users
- [ ] `CustomerSegment` — CRM segment definitions
- [ ] `CustomerSegmentMember` — segment membership join table
- [ ] `Campaign` — marketing campaign management
- [ ] `BranchDailySnapshot` — analytics daily rollup
- [ ] `AnomalyFlag` — anomaly detection records

### Renamed Models (3)

- [ ] `BarberProfile` → `StaffProfile` (update all relations, map to `staff_profiles`)
- [ ] `BarberAttendance` → `StaffAttendance` (update all relations, map to `staff_attendances`)
- [ ] `BarberEarning` → `StaffEarning` (update all relations, map to `staff_earnings`)

### Removed Models (2)

- [ ] REMOVE `StaffAssignment` table — replaced by `User.branchId`
- [ ] REMOVE `LoyaltyAccount` model — replaced by `CustomerMembership`

### Modified Models — Add `organizationId`

Add `organizationId String` + `organization Organization @relation(...)` + `@@index([organizationId])` to:

- [ ] `User` — also add `tenantRoleId`, `branchId`, `isCustomer`, `authProvider`, `googleId`, `emailVerified`; remove `role`, `favoriteBranchId`, `referralCode`, `referredById`; add `@@unique([organizationId, email])`, `@@unique([organizationId, phone])`
- [ ] `Branch` — also add `maxDiscountPercent`, `isEmergencyClosed`, `averageRating`, `totalReviews`
- [ ] `Service` — also add `roleServices TenantRoleService[]` relation
- [ ] `RefreshToken`
- [ ] `OperatingHour`
- [ ] `ComboService`
- [ ] `TierSurcharge`
- [ ] `BranchServiceOverride`
- [ ] `SurgeRule`
- [ ] `Booking`
- [ ] `BookingItem`
- [ ] `QueueEntry` — also rename `barberProfileId` → `staffProfileId`
- [ ] `Transaction`
- [ ] `TransactionItem`
- [ ] `Payment`
- [ ] `StaffAttendance` (renamed)
- [ ] `ShiftSchedule`
- [ ] `StaffEarning` (renamed)
- [ ] `PayrollPeriod`
- [ ] `CommissionTier` — rename `barberProfileId` → `staffProfileId`
- [ ] `LoyaltyTransaction` — rename `loyaltyAccountId` → `customerMembershipId`
- [ ] `PromoCode`
- [ ] `Review` — rename `barberProfileId` → `staffProfileId`
- [ ] `Product`
- [ ] `BranchInventory`
- [ ] `StockMovement`
- [ ] `AuditLog` — replace `role Role?` with `tenantRoleId String?`

### Renamed Fields on Existing Models

- [ ] `Booking.barberProfileId` → `staffProfileId`
- [ ] `QueueEntry.barberProfileId` → `staffProfileId`
- [ ] `Transaction.barberProfileId` → `staffProfileId`
- [ ] `Review.barberProfileId` → `staffProfileId`
- [ ] `CommissionTier.barberProfileId` → `staffProfileId`
- [ ] `ShiftSchedule.barberProfileId` → `staffProfileId`
- [ ] `LoyaltyTransaction.loyaltyAccountId` → `customerMembershipId`
- [ ] `TierSurcharge.tier` type: `BarberTier` → `StaffTier`
- [ ] `AuditLog.role` field removed, replaced with `tenantRoleId`

### Verification

```bash
rm -rf apps/api/prisma/migrations/
npx prisma generate --schema=apps/api/prisma/schema.prisma
npx prisma migrate dev --name saas_platform_init
```

- [ ] `prisma generate` succeeds with zero errors
- [ ] `prisma migrate dev` creates 1 clean migration
- [ ] Git checkpoint: `git add . && git commit -m "Phase 7A: Multi-tenant schema"`

### Rollback

```bash
git checkout HEAD -- apps/api/prisma/
npx prisma migrate reset
```

---

## Phase 7B: API Backend Refactor

### Phase 7B-1: New Middleware Layer

> **Why first in 7B:** All feature files will depend on the new middleware signatures.

#### Files Changed

| File | Action |
|------|--------|
| `apps/api/src/middlewares/auth.ts` | Rewrite: keep `authMiddleware()`, replace `requireRole()` with `requirePermission()`, add org/branch scope middleware (DONE: `requirePermission()` replaces `requireRole()`) |
| `apps/api/src/middlewares/rbac.ts` | NEW: `requirePermission()`, permission cache (LRU), `getPermissionsFromCache()` |
| `apps/api/src/middlewares/scope.ts` | NEW: `scopeToOrg()` Prisma extension, `scopeToBranch()` filter |
| `apps/api/src/types.ts` | Update `AppEnv.Variables` to add `organizationId`, `tenantRoleId`, `branchId`, `isCustomer`, `scope`, `db` (scoped) |

#### Checklist

- [ ] Update `apps/api/src/types.ts` — add new context variables:

```typescript
Variables: {
  db: PrismaClient;        // org-scoped Prisma client
  userId?: string;
  organizationId?: string;
  tenantRoleId?: string;
  branchId?: string;
  isCustomer?: boolean;
  scope?: "HQ" | "BRANCH" | "CUSTOMER";
};
```

- [ ] Update `authMiddleware()` in `apps/api/src/middlewares/auth.ts` — extract new JWT claims (`organizationId`, `tenantRoleId`, `branchId`, `isCustomer`, `scope`) and set on context; remove old `role` claim
- [ ] Create `apps/api/src/middlewares/rbac.ts`:
  - `requirePermission(featureCode: string, action: "create" | "read" | "update" | "delete")` middleware
  - In-memory LRU permission cache (`Map<tenantRoleId, Map<featureCode, CRUD booleans>>`)
  - Cache invalidation function `invalidatePermissionCache(tenantRoleId: string)`
  - 5-minute TTL fallback
- [ ] Create `apps/api/src/middlewares/scope.ts`:
  - `scopeToOrg(db, orgId)` — Prisma `$extends` that auto-injects `organizationId` into all queries
  - `scopeToBranch(db, branchId)` — additional branch filter for BRANCH-scoped users
  - Org-scoping middleware that sets `c.set("db", scopedDb)` based on JWT claims
- [x] Remove `requireRole()` from `apps/api/src/middlewares/auth.ts` (replaced by `requirePermission()`)
- [ ] Git checkpoint: `git commit -m "Phase 7B-1: RBAC middleware layer"`

#### Verification

```bash
pnpm --filter @tmng/saas-api typecheck
```

---

### Phase 7B-2: Refactor 26 Feature Files

> **Why:** Replace all `requireRole()` with `requirePermission()`, rename `barber` → `staff` everywhere. (DONE)

Every feature directory under `apps/api/src/features/` follows the pattern:
- `*.index.ts` — route definitions and middleware
- `*.handlers.ts` — request handlers
- `*.service.ts` — business logic
- `*.schema.ts` — Zod validation schemas

#### Global Renames (apply across all feature files)

- [ ] `barberProfileId` → `staffProfileId` (in schemas, services, handlers)
- [ ] `barberProfile` → `staffProfile` (in includes/selects)
- [ ] `BarberProfile` → `StaffProfile` (in Prisma model references)
- [ ] `BarberAttendance` → `StaffAttendance` (in Prisma model references)
- [ ] `BarberEarning` → `StaffEarning` (in Prisma model references)
- [ ] `barberTier` / `BarberTier` → `staffTier` / `StaffTier`
- [ ] `barberStatus` / `BarberStatus` → `staffStatus` / `StaffStatus`
- [ ] `IN_CHAIR` → `IN_SERVICE` (in queue status references)
- [ ] `PER_BARBER` → `PER_STAFF` (in tip distribution references)
- [ ] `loyaltyAccountId` → `customerMembershipId`
- [ ] `LoyaltyAccount` → `CustomerMembership`
- [ ] `role` (from old Role enum) → remove or replace with `tenantRoleId`/`scope` checks

#### Feature-by-Feature Checklist

**1. `barbers/` → RENAME TO `staff/`**

- [ ] Rename directory: `apps/api/src/features/barbers/` → `apps/api/src/features/staff/`
- [ ] Rename files: `barbers.*.ts` → `staff.*.ts`
- [ ] Update exports: `barbersApp` → `staffApp`
- [ ] Update route mount in `apps/api/src/index.ts`: `apiApp.route("/barbers", barbersApp)` → `apiApp.route("/staff", staffApp)`
- [x] Replace `requireRole("MANAGER", "SUPER_ADMIN")` → `requirePermission("STAFF_MANAGEMENT", "read"|"create"|"update"|"delete")`
- [ ] Rename all internal references: `barberProfile` → `staffProfile`, `getBarberProfile` → `getStaffProfile`, etc.

**2. `auth/`**

- [ ] `auth.service.ts` — add `orgSlug` lookup in login flow, generate new JWT claims (`organizationId`, `tenantRoleId`, `branchId`, `isCustomer`, `scope`), remove `role` from JWT
- [ ] `auth.schema.ts` — add `orgSlug` to login schema, add customer registration schema with org context
- [ ] `auth.handlers.ts` — update login handler, add Google OAuth handler, add customer registration handler
- [ ] `auth.index.ts` — add routes for Google OAuth and customer registration

**3. `queue/`**

- [x] `queue.index.ts` — replace `requireRole()` with path-specific `requirePermission("QUEUE_MANAGEMENT", ...)`, use flat routing pattern (not sub-app wildcard)
- [ ] `queue.schema.ts` — rename `barberProfileId` → `staffProfileId` in all Zod schemas
- [ ] `queue.service.ts` — rename all barber references → staff, use scoped `db` from context
- [ ] `queue.handlers.ts` — rename barber references → staff

**4. `transactions/`**

- [x] `transactions.index.ts` — replace `requireRole()` → `requirePermission("TRANSACTION", ...)`
- [ ] `transactions.schema.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `transactions.service.ts` — rename barber → staff, use scoped db
- [ ] `transactions.handlers.ts` — rename barber → staff

**5. `attendance/`**

- [x] `attendance.index.ts` — replace `requireRole()` → `requirePermission("ATTENDANCE", ...)`
- [ ] `attendance.schema.ts` — rename barber references → staff
- [ ] `attendance.service.ts` — rename `BarberAttendance` → `StaffAttendance`, barber → staff
- [ ] `attendance.handlers.ts` — rename barber → staff

**6. `commissions/`**

- [ ] `commissions.index.ts` — `requirePermission("COMMISSION", ...)`
- [ ] `commissions.schema.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `commissions.service.ts` — rename `BarberEarning` → `StaffEarning`, barber → staff
- [ ] `commissions.handlers.ts` — rename barber → staff

**7. `payroll/`**

- [ ] `payroll.index.ts` — `requirePermission("PAYROLL", ...)`
- [ ] `payroll.schema.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `payroll.service.ts` — rename barber → staff
- [ ] `payroll.handlers.ts` — rename barber → staff

**8. `services/`**

- [ ] `services.index.ts` — `requirePermission("SERVICE_CATALOG", ...)`
- [ ] `services.service.ts` — add `organizationId` scoping
- [ ] `services.schema.ts` — update as needed
- [ ] `services.handlers.ts` — use scoped db

**9. `branches/`**

- [ ] `branches.index.ts` — `requirePermission("BRANCH_MANAGEMENT", ...)`
- [ ] `branches.service.ts` — add `organizationId` scoping, add emergency closure / holiday endpoints
- [ ] `branches.schema.ts` — add holiday and emergency schemas
- [ ] `branches.handlers.ts` — add new handlers

**10. `inventory/`**

- [ ] `inventory.index.ts` — `requirePermission("INVENTORY", ...)`
- [ ] All files — use scoped db

**11. `promotions/`**

- [ ] `promotions.index.ts` — `requirePermission("PROMOTIONS", ...)`
- [ ] All files — use scoped db

**12. `loyalty/`**

- [ ] `loyalty.index.ts` — `requirePermission("LOYALTY", ...)`
- [ ] `loyalty.service.ts` — rename `loyaltyAccount` → `customerMembership`, `LoyaltyAccount` → `CustomerMembership`
- [ ] `loyalty.schema.ts` — update references
- [ ] `loyalty.handlers.ts` — update references

**13. `referrals/`**

- [ ] `referrals.index.ts` — `requirePermission("REFERRALS", ...)`
- [ ] All files — use scoped db

**14. `reviews/`**

- [ ] `reviews.index.ts` — `requirePermission("REVIEWS", ...)`
- [ ] `reviews.schema.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `reviews.service.ts` — rename barber → staff
- [ ] `reviews.handlers.ts` — rename barber → staff

**15. `cash-drawer/`**

- [ ] `cash-drawer.index.ts` — `requirePermission("CASH_DRAWER", ...)`
- [ ] All files — use scoped db

**16. `crm/`**

- [ ] `crm.index.ts` — `requirePermission("CRM", ...)`
- [ ] All files — use scoped db

**17. `campaigns/`**

- [ ] `campaigns.index.ts` — `requirePermission("CAMPAIGNS", ...)`
- [ ] All files — use scoped db

**18. `retention/`**

- [ ] `retention.index.ts` — `requirePermission("RETENTION", ...)`
- [ ] All files — use scoped db

**19. `analytics/`**

- [ ] `analytics.index.ts` — `requirePermission("ANALYTICS", ...)`
- [ ] All files — use scoped db

**20. `reports/`**

- [ ] `reports.index.ts` — `requirePermission("REPORTS", ...)`
- [ ] `reports.service.ts` — rename barber references → staff (e.g., `barber_leaderboard` → `staff_leaderboard`)
- [ ] All files — use scoped db

**21. `finance/`**

- [ ] `finance.index.ts` — `requirePermission("FINANCE_REPORTS", ...)`
- [ ] All files — use scoped db

**22. `users/`**

- [ ] `users.index.ts` — `requirePermission("USER_MANAGEMENT", ...)`
- [ ] `users.service.ts` — update to use new user model (no more `role` field, use `tenantRoleId`)
- [ ] `users.schema.ts` — update schemas for new user structure
- [ ] `users.handlers.ts` — update handlers

**23. `audit/`**

- [ ] `audit.index.ts` — `requirePermission("AUDIT_LOG", ...)`
- [ ] `audit.service.ts` — replace `role` field with `tenantRoleId` in audit entries
- [ ] All files — use scoped db

**24. `config/`**

- [ ] `config.index.ts` — `requirePermission("ORG_SETTINGS", ...)`
- [ ] All files — use scoped db

**25. `payments/`**

- [ ] `payments.index.ts` — `requirePermission("TRANSACTION", ...)` (payments are part of transaction feature)
- [ ] All files — use scoped db

**26. `media/`**

- [ ] `media.index.ts` — auth middleware only (media upload available to any authenticated user)
- [ ] All files — use scoped db

**27. `health/`**

- [ ] `health.index.ts` — no auth needed, no changes required

#### Update Main App Mount

- [ ] `apps/api/src/index.ts` — change `apiApp.route("/barbers", barbersApp)` → `apiApp.route("/staff", staffApp)`, update import

#### Verification

```bash
pnpm --filter @tmng/saas-api typecheck
```

- [ ] Zero type errors
- [ ] Git checkpoint: `git commit -m "Phase 7B-2: All features refactored to RBAC + generic naming"`

---

### Phase 7B-3: Auth Refactor

> **Why:** Login must now resolve orgSlug, JWT must carry new claims.

#### Files Changed

| File | Action |
|------|--------|
| `apps/api/src/features/auth/auth.schema.ts` | Add `orgSlug` to login body, add customer registration schema, add Google OAuth schema |
| `apps/api/src/features/auth/auth.service.ts` | Org lookup by slug, new JWT payload, Google OAuth verification, customer registration |
| `apps/api/src/features/auth/auth.handlers.ts` | New routes for Google login, customer register |
| `apps/api/src/features/auth/auth.index.ts` | Mount new routes |

#### Checklist

- [ ] Login flow: accept `orgSlug` in body → lookup `Organization` by slug → verify user belongs to that org → issue JWT with `{ userId, organizationId, tenantRoleId, branchId, isCustomer, scope }`
- [ ] Remove `role` from JWT payload (replaced by `tenantRoleId` + `scope`)
- [ ] Google OAuth route: `POST /api/auth/google` — verify Google ID token, find or create user with `authProvider: GOOGLE`, `googleId`, `emailVerified: true`
- [ ] Customer registration: `POST /api/auth/register` — create user with `isCustomer: true`, auto-assign Customer role, auto-create `CustomerMembership`
- [ ] Platform admin auth: `POST /api/platform/auth/login` — separate flow using `PlatformAdmin` table
- [ ] Refresh token flow — include `organizationId` in refresh token lookup
- [ ] Git checkpoint: `git commit -m "Phase 7B-3: Auth refactor with orgSlug + Google OAuth"`

---

### Phase 7B-4: Platform Admin Endpoints

> **Why:** Platform admins manage orgs and templates — separate from tenant users.

#### Files Changed

| File | Action |
|------|--------|
| `apps/api/src/features/platform/` | NEW directory with `platform.index.ts`, `platform.handlers.ts`, `platform.service.ts`, `platform.schema.ts` |

#### Checklist

- [ ] Create `apps/api/src/features/platform/` directory
- [ ] `POST /api/platform/auth/login` — platform admin login (separate JWT issuer)
- [ ] `GET /api/platform/organizations` — list all orgs (paginated)
- [ ] `POST /api/platform/organizations` — create org (seeds roles from template)
- [ ] `PATCH /api/platform/organizations/:id` — update org settings
- [ ] `DELETE /api/platform/organizations/:id` — deactivate org (soft delete)
- [ ] `GET /api/platform/features` — list all 25 features
- [ ] `GET /api/platform/templates` — list industry templates
- [ ] Mount in `apps/api/src/index.ts`: `apiApp.route("/platform", platformApp)`
- [ ] Add platform admin auth middleware (verify `PlatformAdmin` JWT, not tenant JWT)
- [ ] Git checkpoint: `git commit -m "Phase 7B-4: Platform admin endpoints"`

---

### Phase 7B-5: Tenant Role Management Endpoints

> **Why:** Org admins must be able to configure roles and permissions without code deploys.

#### Files Changed

| File | Action |
|------|--------|
| `apps/api/src/features/roles/` | NEW directory with `roles.index.ts`, `roles.handlers.ts`, `roles.service.ts`, `roles.schema.ts` |

#### Checklist

- [ ] Create `apps/api/src/features/roles/` directory
- [ ] `GET /api/roles` — list roles for current org
- [ ] `POST /api/roles` — create custom role
- [ ] `PATCH /api/roles/:id` — update role name/description/scope
- [ ] `DELETE /api/roles/:id` — delete role (blocked for system roles)
- [ ] `GET /api/roles/:id/permissions` — get CRUD permission matrix for a role
- [ ] `PUT /api/roles/:id/permissions` — set entire permission matrix for a role
- [ ] `GET /api/roles/:id/services` — get assigned services for a service-provider role
- [ ] `PUT /api/roles/:id/services` — set assigned services for a service-provider role
- [ ] Invalidate permission cache when permissions or roles are updated
- [ ] Mount in `apps/api/src/index.ts`: `apiApp.route("/roles", rolesApp)`
- [ ] RBAC: `requirePermission("ROLE_MANAGEMENT", ...)` on all role endpoints
- [ ] Git checkpoint: `git commit -m "Phase 7B-5: Tenant role management endpoints"`

---

## Phase 7C: Seed Data

> **Why:** Fresh database needs realistic dev data that matches the new schema structure.

### Files Changed

| File | Action |
|------|--------|
| `apps/api/prisma/seed.ts` | Complete rewrite |

### Platform Seed (global, runs first)

- [ ] Seed 25 `Feature` records (one per feature in catalog — see [rbac_system.md](rbac_system.md))
- [ ] Seed 4 `IndustryTemplate` records (BARBERSHOP, VET_CLINIC, MASSAGE, GENERAL_SERVICE) with `templateData` JSON containing role definitions and default permissions
- [ ] Seed 1 `PlatformAdmin` (email: `admin@tmng.dev`, password: `PlatformAdmin123!`, role: `PLATFORM_ADMIN`)

### Barbershop Dev Seed (tenant-level)

- [ ] Create 1 `Organization` (name: "Budi's Barbershop", slug: `budis-barbershop`, industryType: `BARBERSHOP`, with full settings: tax 11%, IDR, Asia/Jakarta, etc.)
- [ ] Create `TenantRole`s from BARBERSHOP template:
  - Owner (HQ, isSystemRole: true, isServiceProvider: false)
  - Manager (BRANCH, isServiceProvider: false)
  - Barber (BRANCH, isServiceProvider: true)
  - Junior Barber (BRANCH, isServiceProvider: true)
  - Cashier (BRANCH, isServiceProvider: false)
  - Customer (CUSTOMER, isSystemRole: true, isServiceProvider: false)
- [ ] Seed `TenantRolePermission` matrix for each role (per [rbac_system.md](rbac_system.md) permission matrix)
- [ ] Create 2 `Branch`es (Central Jakarta, Kemang) with operating hours
- [ ] Create sample `User`s:
  - Super Admin/Owner: `tenantRoleId` → Owner, `branchId` → null (HQ), `isCustomer` → false
  - Manager: `tenantRoleId` → Manager, `branchId` → branch1, `isCustomer` → false
  - 3 Barbers: `tenantRoleId` → Barber/Junior Barber, `branchId` → set, `isCustomer` → false
  - Cashier: `tenantRoleId` → Cashier, `branchId` → branch1, `isCustomer` → false
  - 2 Customers: `tenantRoleId` → Customer, `branchId` → null, `isCustomer` → true
- [ ] Create `StaffProfile` for service-provider users (Barber, Junior Barber roles)
- [ ] Create `CustomerMembership` for customer users
- [ ] Create `Service`s (Haircut, Shave, Hair Coloring, Hot Towel, Combo)
- [ ] Create `TenantRoleService` assignments:
  - Barber → all services (no records = all services)
  - Junior Barber → [Haircut, Shave] only
- [ ] Seed `TierSurcharge`, `SurgeRule`, `PromoCode` records
- [ ] Seed `Product`s and `BranchInventory`
- [ ] **NO transactional data** (no queue entries, bookings, transactions — start clean for testing)

### Verification

```bash
npx prisma db seed
pnpm --filter @tmng/saas-api typecheck
```

- [ ] Seed completes without errors
- [ ] Can login with seeded users via API
- [ ] Git checkpoint: `git commit -m "Phase 7C: New multi-tenant seed data"`

---

## Phase 7D: Frontend Type Updates

> **Why:** Frontend TypeScript types must match the new generic API contract. UI stays barbershop-themed.

### Admin App (`apps/admin/`)

#### Auth Store & Types

- [ ] `apps/admin/src/features/auth/store.ts`:
  - Replace `role: string` → `tenantRole: { id: string; name: string; scope: string }`
  - Replace `barberProfile` → `staffProfile`
  - Replace `ALLOWED_ROLES` array → check `scope !== "CUSTOMER"` (any non-customer can access admin)
  - Rename persist key `barber-admin-session` → `tmng-admin-session`
- [ ] `apps/admin/src/features/auth/types.ts` — update `UserSession` type
- [ ] `apps/admin/src/features/auth/api/use-auth.ts` — add `orgSlug` to login mutation body
- [ ] `apps/admin/src/features/auth/api/use-auth-me.ts` — update response type (no more `barberProfile`)

#### Barber → Staff Renames

- [ ] Rename `apps/admin/src/features/barbers/` → `apps/admin/src/features/staff/`
- [ ] `use-barbers.ts` → `use-staff.ts`: rename types `BarberResponse` → `StaffResponse`, API endpoint `/barbers` → `/staff`, hooks `useBarbers` → `useStaff`, `useCreateBarber` → `useCreateStaff`, `useUpdateBarber` → `useUpdateStaff`
- [ ] `use-user-search.ts` — keep as is (searches users, not barber-specific)
- [ ] Rename `apps/admin/src/pages/barbers/page.tsx` → `apps/admin/src/pages/staff/page.tsx`
- [ ] Rename `apps/admin/src/pages/barber-portal/` → `apps/admin/src/pages/staff-portal/`: `my-schedule.tsx`, `my-commissions.tsx`, `my-attendance.tsx`

#### Feature-Specific Renames

- [ ] `apps/admin/src/features/attendance/api/use-attendance.ts` — rename `barberId` → `staffProfileId`
- [ ] `apps/admin/src/features/commissions/api/use-earnings.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `apps/admin/src/features/payroll/api/use-payroll-periods.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `apps/admin/src/features/payroll/widgets/payroll-manager.tsx` — rename barber display
- [ ] `apps/admin/src/features/pos/api/use-create-transaction.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `apps/admin/src/features/queue/api/use-queue.ts` — rename `barberId` → `staffProfileId`, `barber` → `staff`, `useAssignBarber` → `useAssignStaff`
- [ ] `apps/admin/src/features/reports/api/use-reports.ts` — rename `barber_leaderboard` → `staff_leaderboard`
- [ ] `apps/admin/src/features/transactions/api/use-transactions.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `apps/admin/src/features/branches/api/use-branch-settings.ts` — rename `PER_BARBER` → `PER_STAFF`

#### Page-Level Renames

- [ ] `apps/admin/src/pages/queue/page.tsx` — rename barber references → staff
- [ ] `apps/admin/src/pages/attendance/page.tsx` — rename barber references → staff
- [ ] `apps/admin/src/pages/transactions/page.tsx` — rename barber references → staff
- [ ] `apps/admin/src/pages/branches/page.tsx` — rename barber references → staff
- [ ] `apps/admin/src/pages/auth/login-page.tsx` — add `orgSlug` field to login form
- [ ] `apps/admin/src/components/layout/sidebar.tsx` — rename barber nav items → staff, update role checks

#### Misc Admin

- [ ] `apps/admin/src/lib/offline-store.ts` — rename key `barber-admin-offline` → `tmng-admin-offline`
- [ ] `apps/admin/src/store/use-branch-store.ts` — rename key `barber-admin-branch` → `tmng-admin-branch`

### Client App (`apps/client/`)

#### Auth Store & Types

- [ ] `apps/client/src/features/auth/store.ts`:
  - Replace `role: string` with `tenantRole: { id: string; name: string; scope: string }` and `isCustomer: boolean`
  - Rename persist key `barber-session-storage` → `tmng-session-storage`
- [ ] `apps/client/src/features/auth/types.ts` — update types
- [ ] `apps/client/src/features/auth/api/use-auth.ts` — add `orgSlug` to login, add Google OAuth login hook

#### Barber → Staff Renames

- [ ] `apps/client/src/features/booking/api/use-barbers.ts` → `use-staff.ts`: rename `BarberResponse` → `StaffResponse`, endpoint `/barbers` → `/staff`
- [ ] `apps/client/src/features/booking/components/barber-selection.tsx` → `staff-selection.tsx`: rename all barber references → staff (keep UI text as "Barber" since this is the barbershop frontend)
- [ ] `apps/client/src/features/booking/store.ts` — rename `selectedBarberId` → `selectedStaffId`, `setBarber` → `setStaff`
- [ ] `apps/client/src/features/booking/types.ts` — rename `BarberResponse` → `StaffResponse`, `barberId` → `staffId`
- [ ] `apps/client/src/features/booking/components/time-selection.tsx` — rename `selectedBarberId` → `selectedStaffId`
- [ ] `apps/client/src/features/booking/components/booking-confirm.tsx` — rename barber → staff
- [ ] `apps/client/src/features/booking/api/use-availability.ts` — rename `barberProfileId` → `staffProfileId`
- [ ] `apps/client/src/features/booking/api/use-create-booking.ts` — rename barber → staff in body

#### Loyalty Renames

- [ ] `apps/client/src/features/loyalty/api/use-loyalty-account.ts` — update for `CustomerMembership` type (renamed from LoyaltyAccount)
- [ ] `apps/client/src/features/loyalty/types/index.ts` — update types

#### Profile & Review Renames

- [ ] `apps/client/src/features/profile/types.ts` — rename `barberProfileId` → `staffProfileId`, `barber` → `staff`
- [ ] `apps/client/src/features/reviews/` — rename `barberProfileId` → `staffProfileId`, `barberName` → `staffName` in all files

#### Client Login Page

- [ ] Add `orgSlug` field to login form (or derive from URL path)
- [ ] Add "Login with Google" button (UI only, calls Google OAuth API)

#### Misc Client

- [ ] `apps/client/vite.config.ts` — keep `short_name: 'Barber'` (this IS the barbershop frontend)

### Verification

```bash
pnpm --filter @tmng/barber-admin typecheck
pnpm --filter @tmng/barber-client typecheck
```

- [ ] Zero type errors in both frontend apps
- [ ] Git checkpoint: `git commit -m "Phase 7D: Frontend types updated for generic API"`

---

## Phase 7E: DevOps & Package Rename

> **Why:** Align all infrastructure naming with the new multi-tenant platform identity.

### Package Renames

| Current | New | File |
|---------|-----|------|
| `@barber/api` | `@tmng/saas-api` | `apps/api/package.json` |
| `@barber/admin` | `@tmng/barber-admin` | `apps/admin/package.json` |
| `@barber/client` | `@tmng/barber-client` | `apps/client/package.json` |
| `the-barber-project` | `tmng-saas-platform` | root `package.json` |

- [ ] `apps/api/package.json` — rename `name` to `@tmng/saas-api`
- [ ] `apps/admin/package.json` — rename `name` to `@tmng/barber-admin`
- [ ] `apps/client/package.json` — rename `name` to `@tmng/barber-client`; update workspace dep `@barber/api` → `@tmng/saas-api`
- [ ] Root `package.json` — rename `name` to `tmng-saas-platform`; update filter scripts: `@barber/api` → `@tmng/saas-api`, `@barber/admin` → `@tmng/barber-admin`, `@barber/client` → `@tmng/barber-client`

### Environment & Infra

- [ ] `apps/api/.env.example` — update DATABASE_URL comment: `barber_db` → `tmng_saas_db`; add all missing vars (Pusher, S3, OneSignal, Xendit)
- [ ] `apps/api/.env` — update DATABASE_URL database name if desired (or keep existing for now)

### GitHub Workflows

- [ ] `.github/workflows/ci.yml`:
  - `pnpm --filter @tmng/barber-admin build`
  - `pnpm --filter @tmng/barber-client build`
  - `--project-name=barber-admin` → `--project-name=tmng-barber-admin`
  - `--project-name=barber-client` → `--project-name=tmng-barber-client`
- [ ] `.github/workflows/deploy-api.yml`:
  - `IMAGE_NAME: .../barber-api` → `IMAGE_NAME: .../tmng-saas-api`
  - `--name barber-api` → `--name tmng-saas-api`
  - `--env-file /opt/barber/.env` → `--env-file /opt/tmng-saas/.env`

### Docker

- [ ] `apps/api/Dockerfile` — update labels/metadata if present
- [ ] Container name: `barber-api` → `tmng-saas-api` (in deploy workflow)

### Seed Script Reference

- [ ] `apps/api/prisma/seed.ts` header comment — update from "The Barber Project" to "TMNG SaaS Platform"
- [x] Update docs to use `pnpm --filter @tmng/saas-api db:seed`

### Verification

```bash
pnpm install
pnpm --filter @tmng/saas-api typecheck
pnpm --filter @tmng/barber-admin typecheck
pnpm --filter @tmng/barber-client typecheck
pnpm lint
```

- [ ] All packages resolve with new names
- [ ] All typechecks pass
- [ ] Git checkpoint: `git commit -m "Phase 7E: Package rename to @tmng/* namespace"`

---

## Phase 7F: Documentation Update

> **Why:** All existing docs reference old naming and architecture. Must be updated for consistency.

### Docs to Update

- [ ] `docs/implementation_plan.md` — add Phase 7 section linking to this sprint doc
- [ ] `docs/platform_architecture.md` — mark as "current" (already written for new architecture)
- [ ] `docs/rbac_system.md` — mark as "current"
- [ ] `docs/database_schema.md` — mark as "current"
- [ ] `docs/hono-setup.md` — update package names, add `requirePermission()` pattern example
- [ ] `docs/phase4_sprint.md` — add note about superseded RBAC pattern
- [ ] `docs/phase5_sprint.md` — add note about superseded naming
- [ ] `docs/phase6_sprint.md` — add note about superseded naming
- [ ] `docs/audit_report.md` — add Phase 7 refactor entry
- [ ] `docs/gap_analysis.md` — add Phase 7 entries, mark RBAC gaps as resolved
- [ ] `README.md` (root) — update project name, description, package names
- [ ] `docs/service_architecture.md` — update with new architecture if applicable

### Verification

- [ ] All docs reference `@tmng/*` naming
- [x] No stale `@barber/*` or `requireRole()` references in docs
- [ ] Git checkpoint: `git commit -m "Phase 7F: Documentation updated for SaaS platform"`

---

## Testing Checklist (Per Phase)

### After Phase 7A (Schema)

```bash
npx prisma generate
npx prisma migrate dev --name saas_platform_init
```

- [ ] Schema generates without errors
- [ ] Migration applies cleanly

### After Phase 7B (API Backend)

```bash
pnpm --filter @tmng/saas-api typecheck
```

- [ ] Zero type errors
- [ ] Curl smoke tests:
  - [ ] `POST /api/auth/login` with `orgSlug` — returns JWT with new claims
  - [ ] `GET /api/queue?branchId=...` — returns data scoped to org
  - [ ] `GET /api/staff` — returns staff (not barbers)
  - [ ] `GET /api/roles` — returns tenant roles
  - [ ] `GET /api/platform/organizations` — returns orgs (platform admin JWT)

### After Phase 7C (Seed)

```bash
npx prisma db seed
```

- [ ] Seed completes
- [ ] Can login as Owner, Manager, Barber, Cashier, Customer with correct permissions
- [ ] Customer cannot access staff-only endpoints
- [ ] Barber can only read queue, not create

### After Phase 7D (Frontend)

```bash
pnpm --filter @tmng/barber-admin typecheck
pnpm --filter @tmng/barber-client typecheck
```

- [ ] Zero type errors in both apps
- [ ] Admin login works with `orgSlug`
- [ ] Client login works with `orgSlug`
- [ ] Queue management page works
- [ ] Booking flow works

### After Phase 7E (DevOps)

```bash
pnpm install
pnpm lint
pnpm typecheck
```

- [ ] All workspace packages resolve
- [ ] CI workflow references updated

### Full E2E After All Phases

- [ ] Walk-in → queue → service → checkout → payment → review
- [ ] Customer booking → confirmation → cancellation
- [ ] Admin role management → create custom role → assign permissions
- [ ] Platform admin → create org → seed roles → login as org user
