# RBAC System — Database-Driven Role & Permission Model

## Overview

The TMNG platform uses a **database-driven RBAC** system where roles and permissions are configurable per organization — no code deploys needed to change who can access what.

```
Feature (global)  ◄──  TenantRolePermission (CRUD)  ──►  TenantRole (per org)
                                                              │
                       TenantRoleService (per role)           │
                       "Which services can this role do?"     │
                                                              ▼
                                                           User
```

## Schema

### TenantRole

```prisma
model TenantRole {
  id               String    @id @default(cuid())
  organizationId   String
  name             String              // "Owner", "Barber", "Vet", "Cashier"
  description      String?
  scope            RoleScope           // HQ | BRANCH | CUSTOMER
  isDefault        Boolean   @default(false)
  isSystemRole     Boolean   @default(false)
  isServiceProvider Boolean  @default(false)  // Users with this role perform services
  sortOrder        Int       @default(0)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  organization Organization          @relation(...)
  permissions  TenantRolePermission[]
  roleServices TenantRoleService[]
  users        User[]

  @@unique([organizationId, name])
  @@map("tenant_roles")
}
```

**Key fields:**

| Field | Purpose |
|-------|---------|
| `scope` | **HQ** = sees all branches, **BRANCH** = sees own branch, **CUSTOMER** = sees own data |
| `isSystemRole` | `true` = cannot be deleted (Owner, Customer) |
| `isDefault` | `true` = was seeded from industry template |
| `isServiceProvider` | `true` = users with this role get a StaffProfile and appear in booking selection |

### TenantRolePermission

```prisma
model TenantRolePermission {
  id           String  @id @default(cuid())
  tenantRoleId String
  featureCode  String           // References Feature.code
  canCreate    Boolean @default(false)
  canRead      Boolean @default(false)
  canUpdate    Boolean @default(false)
  canDelete    Boolean @default(false)

  tenantRole TenantRole @relation(...)
  feature    Feature    @relation(...)

  @@unique([tenantRoleId, featureCode])
  @@map("tenant_role_permissions")
}
```

One row per (role, feature) combination. If no row exists for a feature, the role has **zero access** to that feature.

### TenantRoleService

```prisma
model TenantRoleService {
  id             String @id @default(cuid())
  tenantRoleId   String
  serviceId      String
  organizationId String

  tenantRole TenantRole @relation(...)
  service    Service    @relation(...)

  @@unique([tenantRoleId, serviceId])
  @@map("tenant_role_services")
}
```

Controls which services a service-provider role can perform.

**Rules:**
- Only applicable when `TenantRole.isServiceProvider = true`
- If **no** TenantRoleService records exist for a role → can perform **ALL** services
- If records exist → can **ONLY** perform those specific services

### Feature

```prisma
model Feature {
  id          String        @id @default(cuid())
  code        String        @unique
  name        String
  description String?
  module      FeatureModule           // CORE | OPS | FINANCE | INTEL | ENGAGE | ADMIN
  sortOrder   Int           @default(0)
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())

  permissions TenantRolePermission[]

  @@map("features")
}
```

Seeded at platform startup. Adding new features requires a code deploy + DB seed (new endpoints + new Feature row).

## Feature Catalog

25 features organized by module:

### CORE — Fundamental Operations

| Code | Name | Dependencies | Description |
|------|------|-------------|-------------|
| `QUEUE_MANAGEMENT` | Queue / Walk-in Management | BRANCH_MANAGEMENT | Manage walk-in queue, call next, assign staff |
| `BOOKING` | Appointment Booking | SERVICE_CATALOG, STAFF_MANAGEMENT | Customer booking flow, scheduling |
| `STAFF_MANAGEMENT` | Staff Profiles & Assignment | BRANCH_MANAGEMENT | Create/edit staff profiles, assign to branches |
| `BRANCH_MANAGEMENT` | Branch Settings & Config | — | Branch CRUD, operating hours, surge rules, holidays |
| `SERVICE_CATALOG` | Services & Pricing | BRANCH_MANAGEMENT | Service CRUD, combos, tier surcharges, branch overrides |

### OPS — Daily Operations

| Code | Name | Dependencies | Description |
|------|------|-------------|-------------|
| `ATTENDANCE` | Clock In/Out & Shifts | STAFF_MANAGEMENT | Staff clock-in/out, shift scheduling |
| `TRANSACTION` | POS / Payments | QUEUE_MANAGEMENT, SERVICE_CATALOG | Create transactions, apply discounts, process payments |
| `CASH_DRAWER` | Cash Reconciliation | TRANSACTION | Open/close cash drawer, end-of-day reconciliation |
| `INVENTORY` | Product Inventory | BRANCH_MANAGEMENT | Product management, stock movements, reorder alerts |

### FINANCE — Financial Management

| Code | Name | Dependencies | Description |
|------|------|-------------|-------------|
| `COMMISSION` | Commission Calculation | TRANSACTION, STAFF_MANAGEMENT | Calculate staff commissions from transactions |
| `PAYROLL` | Payroll Processing | COMMISSION | Generate, submit, approve, dispute, disburse payroll |
| `FINANCE_REPORTS` | Financial Reports | TRANSACTION | Revenue summaries, tax reports, financial breakdown |

### INTEL — Business Intelligence

| Code | Name | Dependencies | Description |
|------|------|-------------|-------------|
| `ANALYTICS` | Dashboard & Charts | TRANSACTION, QUEUE_MANAGEMENT | Real-time dashboard, heatmaps, forecasts |
| `REPORTS` | Export Reports | varies | Generate downloadable reports (CSV, PDF) |

### ENGAGE — Customer Engagement

| Code | Name | Dependencies | Description |
|------|------|-------------|-------------|
| `LOYALTY` | Loyalty Program | TRANSACTION | Points earning/redemption, tier management |
| `PROMOTIONS` | Promo Codes | TRANSACTION | Create/validate promo codes, usage tracking |
| `REVIEWS` | Customer Reviews | BOOKING, STAFF_MANAGEMENT | Star ratings, text comments, moderation |
| `REFERRALS` | Referral System | LOYALTY | Referral codes, bonus points on signup |
| `CAMPAIGNS` | Marketing Campaigns | — | Email/push/in-app campaign management |
| `CRM` | Customer Management | — | Customer segments, behavior analysis |
| `RETENTION` | Retention Analytics | ANALYTICS | Churn prediction, win-back triggers |

### ADMIN — System Administration

| Code | Name | Dependencies | Description |
|------|------|-------------|-------------|
| `AUDIT_LOG` | Audit Trail | — | View all system actions with before/after snapshots |
| `USER_MANAGEMENT` | User CRUD | — | Create/edit/deactivate users, assign roles |
| `ROLE_MANAGEMENT` | Role & Permission Config | USER_MANAGEMENT | Create custom roles, edit permission matrix |
| `ORG_SETTINGS` | Organization Settings | — | Tax, currency, timezone, business defaults |

## Permission Check Middleware

### Before (hardcoded)

```typescript
app.use("/*", requireRole("MANAGER", "SUPER_ADMIN"));
```

### After (database-driven)

```typescript
app.use("/*", requirePermission("PAYROLL", "read"));
```

### Implementation

```typescript
type Action = "create" | "read" | "update" | "delete";

function requirePermission(featureCode: string, action: Action) {
  return async (c: Context, next: Next) => {
    const tenantRoleId = c.var.tenantRoleId;
    const permissions = await getPermissionsFromCache(tenantRoleId);
    const featurePerms = permissions.get(featureCode);

    if (!featurePerms) {
      return c.json({ success: false, message: "Forbidden" }, 403);
    }

    const actionMap = { create: "canCreate", read: "canRead", update: "canUpdate", delete: "canDelete" };
    if (!featurePerms[actionMap[action]]) {
      return c.json({ success: false, message: "Forbidden" }, 403);
    }

    await next();
  };
}
```

### Permission Cache

```
In-memory Map<tenantRoleId, Map<featureCode, { canCreate, canRead, canUpdate, canDelete }>>

- Loaded on first request per role
- Invalidated when TenantRole or TenantRolePermission is updated
- TTL: 5 minutes fallback
- No Redis needed (single-instance API on VPS)
```

## Scope-Based Data Filtering

After permission check passes, queries are automatically scoped:

```typescript
// Middleware sets scoped DB client
app.use(async (c, next) => {
  const orgId = c.var.organizationId;
  const scope = c.var.scope;
  const branchId = c.var.branchId;

  let scopedDb = scopeToOrg(prisma, orgId);

  if (scope === "BRANCH" && branchId) {
    scopedDb = scopeToBranch(scopedDb, branchId);
  }

  c.set("db", scopedDb);
  await next();
});
```

| Scope | Filter Applied | What User Sees |
|-------|---------------|----------------|
| `HQ` | `WHERE organizationId = orgId` | All branches in org |
| `BRANCH` | `WHERE organizationId = orgId AND branchId = branchId` | Own branch only |
| `CUSTOMER` | `WHERE organizationId = orgId AND customerId = userId` | Own data only |

## Industry Templates

When a platform admin creates a new organization, they select an industry type. The system seeds default roles from the corresponding `IndustryTemplate`.

### BARBERSHOP Template

| Role | Scope | isServiceProvider | Key Permissions |
|------|-------|-------------------|-----------------|
| Owner | HQ | false | ALL features, full CRUD |
| Manager | BRANCH | false | Queue, Booking, Staff(R/U), Inventory, Analytics(R), Reports |
| Barber | BRANCH | true | Queue(R/U), Attendance(C/R), Commission(R), Payroll(R) |
| Junior Barber | BRANCH | true | Queue(R/U), Attendance(C/R), Commission(R) |
| Cashier | BRANCH | false | Queue(C/R/U), Transaction(C/R/U), Cash Drawer(C/R/U), Inventory(R) |
| Customer | CUSTOMER | false | Booking(C/R/U), Reviews(C/R/U/D), Loyalty(R), Referrals(C/R) |

**Service assignments:**
- Barber → all services
- Junior Barber → basic services only (Haircut, Shave)

### VET_CLINIC Template

| Role | Scope | isServiceProvider | Key Permissions |
|------|-------|-------------------|-----------------|
| Owner | HQ | false | ALL features, full CRUD |
| Vet | BRANCH | true | Queue(R/U), Attendance(C/R), Commission(R), Payroll(R) |
| Groomer | BRANCH | true | Queue(R/U), Attendance(C/R), Commission(R) |
| Receptionist | BRANCH | false | Queue(C/R/U), Transaction(C/R/U), Inventory(R) |
| Pet Owner | CUSTOMER | false | Booking(C/R/U), Reviews(C/R/U/D), Loyalty(R) |

**Service assignments:**
- Vet → Vaccination, Check-up, Surgery
- Groomer → Grooming, Bath, Nail Trim

### MASSAGE Template

| Role | Scope | isServiceProvider | Key Permissions |
|------|-------|-------------------|-----------------|
| Owner | HQ | false | ALL features, full CRUD |
| Therapist | BRANCH | true | Queue(R/U), Attendance(C/R), Commission(R), Payroll(R) |
| Front Desk | BRANCH | false | Queue(C/R/U), Transaction(C/R/U), Cash Drawer(C/R/U) |
| Client | CUSTOMER | false | Booking(C/R/U), Reviews(C/R/U/D), Loyalty(R) |

**Service assignments:**
- Therapist → all massage services

### GENERAL_SERVICE Template

| Role | Scope | isServiceProvider | Key Permissions |
|------|-------|-------------------|-----------------|
| Owner | HQ | false | ALL features, full CRUD |
| Manager | BRANCH | false | Most features, limited write |
| Staff | BRANCH | true | Queue(R/U), Attendance(C/R), Commission(R) |
| Cashier | BRANCH | false | Queue(C/R/U), Transaction(C/R/U) |
| Customer | CUSTOMER | false | Booking(C/R/U), Reviews(C/R/U/D) |

## Full Permission Matrix — BARBERSHOP

Rows = Features, Columns = Roles. `C`=Create, `R`=Read, `U`=Update, `D`=Delete.

```
Feature              Owner         Manager       Barber        Cashier       Customer
                     (HQ)          (BRANCH)      (BRANCH)      (BRANCH)      (CUSTOMER)
──────────────────── ───────────── ───────────── ───────────── ───────────── ─────────────
QUEUE_MANAGEMENT     C R U D       C R U D       · R U ·       C R U ·       · · · ·
BOOKING              C R U D       C R U D       · · · ·       · · · ·       C R U ·
STAFF_MANAGEMENT     C R U D       · R U ·       · · · ·       · · · ·       · · · ·
BRANCH_MANAGEMENT    C R U D       · R U ·       · · · ·       · · · ·       · · · ·
SERVICE_CATALOG      C R U D       C R U D       · · · ·       · · · ·       · R · ·
ATTENDANCE           C R U D       C R U D       C R · ·       · · · ·       · · · ·
TRANSACTION          C R U D       C R U ·       · · · ·       C R U ·       · · · ·
CASH_DRAWER          C R U D       C R U ·       · · · ·       C R U ·       · · · ·
INVENTORY            C R U D       C R U D       · · · ·       · R · ·       · · · ·
COMMISSION           C R U D       C R · ·       · R · ·       · · · ·       · · · ·
PAYROLL              C R U D       · R · ·       · R · ·       · · · ·       · · · ·
FINANCE_REPORTS      C R U D       · R · ·       · · · ·       · · · ·       · · · ·
ANALYTICS            C R U D       · R · ·       · · · ·       · · · ·       · · · ·
REPORTS              C R U D       C R · ·       · · · ·       · · · ·       · · · ·
LOYALTY              C R U D       C R U ·       · · · ·       · · · ·       · R · ·
PROMOTIONS           C R U D       C R U D       · · · ·       · · · ·       · · · ·
REVIEWS              C R U D       · R U ·       · · · ·       · · · ·       C R U D
REFERRALS            C R U D       · R · ·       · · · ·       · · · ·       C R · ·
CAMPAIGNS            C R U D       C R U ·       · · · ·       · · · ·       · · · ·
CRM                  C R U D       · R · ·       · · · ·       · · · ·       · · · ·
RETENTION            C R U D       · R · ·       · · · ·       · · · ·       · · · ·
AUDIT_LOG            · R · ·       · R · ·       · · · ·       · · · ·       · · · ·
USER_MANAGEMENT      C R U D       C R U ·       · · · ·       · · · ·       · · · ·
ROLE_MANAGEMENT      C R U D       · R · ·       · · · ·       · · · ·       · · · ·
ORG_SETTINGS         C R U D       · R · ·       · · · ·       · · · ·       · · · ·
```

**The org Owner can customize this matrix at any time through the admin UI** — no code deploy needed.

## API Endpoints

### Role Management

```
GET    /api/roles                     List roles for current org
POST   /api/roles                     Create custom role
PATCH  /api/roles/:id                 Update role name/description/scope
DELETE /api/roles/:id                 Delete custom role (not system roles)
GET    /api/roles/:id/permissions     Get CRUD matrix for role
PUT    /api/roles/:id/permissions     Set CRUD matrix for role
GET    /api/roles/:id/services        Get assigned services for role
PUT    /api/roles/:id/services        Set assigned services for role
```

### Platform Admin

```
POST   /api/platform/auth/login              Platform admin login
GET    /api/platform/organizations            List all orgs
POST   /api/platform/organizations            Create org (seeds from template)
PATCH  /api/platform/organizations/:id        Update org
DELETE /api/platform/organizations/:id        Deactivate org
GET    /api/platform/features                 List all features
GET    /api/platform/templates                List industry templates
```
