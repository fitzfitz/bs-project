# TMNG — Platform Architecture

> Headless, multi-tenant service business management platform with industry-specific frontends.

## 1. Platform Overview

TMNG is a **headless SaaS engine** that powers appointment-based / on-premises service businesses. The backend API is industry-agnostic; each frontend is a themed product skin for a specific industry.

```
                         ┌──────────────────────────┐
                         │     @tmng/saas-api        │
                         │    (Headless Engine)       │
                         │                            │
                         │  - Multi-tenant            │
                         │  - Feature-based RBAC      │
                         │  - Industry-agnostic       │
                         │  - Org-scoped queries      │
                         └─────────────┬──────────────┘
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
    ┌──────────▼──────────┐ ┌──────────▼──────────┐ ┌─────────▼───────────┐
    │ @tmng/barber-admin  │ │ @tmng/barber-client │ │ Future frontends    │
    │ @tmng/barber-client │ │ (customer PWA)      │ │ @tmng/vet-admin     │
    │ (barbershop skin)   │ │                     │ │ @tmng/massage-client│
    └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

## 2. SaaS Type

**Multi-Vertical B2B2C SaaS Platform**

- **B2B**: Business owners (barbershop owner, vet clinic owner) pay for the platform
- **B2C**: End consumers (customers) use the client app to book, pay, review
- **Multi-Vertical**: Serves a category of industries — appointment-based service businesses

**Target industries**: Barbershops, vet clinics, massage studios, nail salons, auto detailing, dental clinics, spas, pet grooming, tattoo parlors, beauty salons.

**Common features** across all industries:
- Queue / appointment scheduling
- Staff management & scheduling
- Service catalog & pricing
- POS / transactions
- Inventory
- Payroll & commissions
- Customer loyalty & reviews

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM LEVEL                                  │
│                   (managed by TMNG platform admins)                     │
│                                                                         │
│  PlatformAdmin     Feature (global catalog)    IndustryTemplate         │
│  ──────────────    ────────────────────────    ─────────────────        │
│  PLATFORM_ADMIN    QUEUE_MANAGEMENT            BARBERSHOP template     │
│  PLATFORM_SUPPORT  PAYROLL                     VET_CLINIC template     │
│                    INVENTORY                    MASSAGE template        │
│                    ANALYTICS                    GENERAL_SERVICE         │
│                    25 features total                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TENANT LEVEL (per Organization)                     │
│                                                                         │
│  Organization ──────── TenantRole ──────── TenantRolePermission        │
│  "Budi's Barbershop"  "Owner" (HQ)        QUEUE: C✓ R✓ U✓ D✓         │
│  industryType:         "Manager" (BRANCH)  PAYROLL: C✗ R✓ U✗ D✗      │
│    BARBERSHOP          "Barber" (BRANCH)   ATTENDANCE: C✓ R✓ U✗ D✗   │
│  taxRate: 0.11         "Cashier" (BRANCH)                              │
│  currency: IDR         "Customer" (CUST)   TenantRoleService           │
│  timezone: Asia/Jkt                        "Barber" → [Haircut, Shave] │
│                                                                         │
│  Branch ──── User ──── StaffProfile / CustomerMembership               │
│  "Central"   branchId  tier, status,        loyaltyPoints,             │
│  "Kemang"    tenantRoleId  commission       referralCode               │
│              isCustomer                                                 │
│              googleId (OAuth)                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4. Multi-Tenancy Model

**Single shared database** with `organizationId` on every tenant-level table.

```
┌──────────────────────────────────────────────┐
│               tmng_saas_db                   │
│                                              │
│  users         (organizationId = org_1)      │
│  users         (organizationId = org_2)      │
│  branches      (organizationId = ...)        │
│  queue_entries (organizationId = ...)        │
│  transactions  (organizationId = ...)        │
│  notifications (organizationId = ...)        │
│  payment_methods (organizationId = ...)     │
│  ... all 40+ tables scoped by org            │
│                                              │
│  One DB. One migration. One backup.          │
└──────────────────────────────────────────────┘
```

**Data isolation** is enforced via Prisma `$extends` middleware that automatically injects `WHERE organizationId = ?` into every query:

```typescript
function scopeToOrg(db: PrismaClient, orgId: string) {
  return db.$extends({
    query: {
      $allOperations({ args, query }) {
        if (args.where) {
          args.where.organizationId = orgId;
        }
        return query(args);
      }
    }
  });
}
```

**Why not separate databases?**
- Prisma doesn't natively support dynamic DB switching
- Platform analytics across all tenants requires cross-DB queries with separate DBs
- Single DB is simpler: one migration, one backup, one connection pool
- If a tenant outgrows the shared DB later, they can be migrated to dedicated infra

## 5. User Model

Users belong to **exactly one organization**. There is no cross-org identity sharing.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   isCustomer = TRUE                    isCustomer = FALSE            │
│   ─────────────────                    ──────────────────            │
│                                                                      │
│   ┌──────────────────┐                ┌──────────────────┐          │
│   │ customer1@gm.com │                │ manager@shop.com │          │
│   │ Rizky Firmansyah │                │ Dewi Sari        │          │
│   │                  │                │                  │          │
│   │ Can:             │                │ Can:             │          │
│   │ • Book appt      │                │ • Manage queue   │          │
│   │ • View history   │                │ • View reports   │          │
│   │ • Leave reviews  │                │ • Manage staff   │          │
│   │ • Use loyalty    │                │ • Handle payroll │          │
│   │ • Cancel booking │                │                  │          │
│   │ • View notifs    │                │                  │          │
│   │ • Manage cards   │                │                  │          │
│   │                  │                │ Has:             │          │
│   │ Has:             │                │ • TenantRole     │          │
│   │ • CustomerMember │                │   "Manager"      │          │
│   │   ship record    │                │   scope: BRANCH  │          │
│   │ • TenantRole     │                │ • branchId set   │          │
│   │   "Customer"     │                │                  │          │
│   │   scope: CUSTOMER│                │                  │          │
│   └──────────────────┘                └──────────────────┘          │
│                                                                      │
│   Accesses: CLIENT app                Accesses: ADMIN app           │
│   Login: /budis-barbershop/login      Login: /budis-barbershop/admin│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Same email at different orgs = two separate accounts.** If Budi wants to be a customer at Barbershop A and also at Barbershop B, he registers separately at each.

### Google OAuth (Customer Only)

```
User fields:
  authProvider   AuthProvider  @default(EMAIL)   // EMAIL | GOOGLE
  googleId       String?       @unique           // Google's "sub" claim
  emailVerified  Boolean       @default(false)

Flow 1: New customer registers via Google
  → authProvider = GOOGLE, googleId = set, passwordHash = null

Flow 2: Existing email user links Google
  → googleId gets populated, can login either way

Flow 3: Staff users
  → Always EMAIL, Google OAuth NOT supported for staff
```

## 6. Role Scope System

The `scope` field on TenantRole replaces the concept of `isHQ`:

```
scope: HQ
├── branchId on User = NULL
├── API queries: no branch filter → sees ALL branches in org
├── Example roles: Owner, HR, Finance Director

scope: BRANCH
├── branchId on User = specific branch
├── API queries: auto-filtered to user's branch
├── Example roles: Manager, Barber/Vet/Therapist, Cashier, Supervisor

scope: CUSTOMER
├── isCustomer on User = true
├── API queries: auto-filtered to user's own data
├── Example roles: Customer, Pet Owner, Client
```

## 7. Service Provider Model

Not all staff perform services. The `isServiceProvider` flag on TenantRole controls this:

```
TenantRole.isServiceProvider = false
  → User is administrative staff (Manager, Cashier, HR)
  → No StaffProfile created
  → NEVER appears in booking/queue service provider selection

TenantRole.isServiceProvider = true
  → User performs services (Barber, Vet, Therapist)
  → StaffProfile auto-created
  → Appears in booking selection
  → Gets attendance, commission, payroll features
```

### Service-to-Role Assignment

Each service-provider role can be restricted to specific services via `TenantRoleService`:

```
Role: "Master Barber"  (isServiceProvider: true)
  └── TenantRoleService: [Haircut, Shave, Hair Coloring, Hot Towel, Combo]
      → Can perform all services

Role: "Junior Barber"  (isServiceProvider: true)
  └── TenantRoleService: [Haircut, Shave]
      → Only basic services (not trained for coloring)

Role: "Manager"  (isServiceProvider: false)
  └── No TenantRoleService records
      → Never appears in booking selection
```

**Rule**: If a role has `isServiceProvider = true` but NO `TenantRoleService` records → can perform ALL services (default = everything).

**Booking selection query:**

```typescript
const providers = await db.staffProfile.findMany({
  where: {
    organizationId: orgId,
    user: {
      branchId,
      isActive: true,
      tenantRole: {
        isServiceProvider: true,
        OR: [
          { roleServices: { none: {} } },
          { roleServices: { some: { serviceId: { in: selectedServiceIds } } } }
        ]
      }
    },
    status: "AVAILABLE"
  }
});
```

## 8. Login Flow

Each organization has its own login URL based on the org `slug`:

```
Customer login:  /budis-barbershop/login
Staff login:     /budis-barbershop/admin

POST /api/auth/login
Body: { email, password, orgSlug: "budis-barbershop" }

JWT contains:
{
  userId,
  organizationId,
  tenantRoleId,
  branchId,         // null for HQ scope
  isCustomer,
  scope              // "HQ" | "BRANCH" | "CUSTOMER"
}
```

## 9. Request Flow

```
Client Request
     │
     ▼
┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐
│  Auth     │───▶│  Extract     │───▶│  Permission Check        │
│  Verify   │    │  JWT claims  │    │                          │
│  JWT      │    │  - userId    │    │  tenantRoleId: "role-mgr"│
│           │    │  - orgId     │    │  featureCode: "PAYROLL"  │
│           │    │  - roleId    │    │  action: "read"          │
│           │    │  - branchId  │    │                          │
│           │    │  - isCustomer│    │  Cache lookup → canRead? │
└──────────┘    └──────────────┘    └──────────┬───────────────┘
                                                │
                                  ┌─────────────▼──────────────┐
                                  │  Scope Filter              │
                                  │                            │
                                  │  HQ?      → see all in org │
                                  │  BRANCH?  → filter by      │
                                  │             branchId        │
                                  │  CUSTOMER? → filter by     │
                                  │              userId         │
                                  └─────────────┬──────────────┘
                                                 │
                                                 ▼
                                           Route Handler
```

## 10. Multi-Industry Example

```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Org: "Budi's Barbershop"       │  │  Org: "Happy Paws Vet Clinic"   │
│  Industry: BARBERSHOP            │  │  Industry: VET_CLINIC            │
│                                  │  │                                  │
│  Roles:                          │  │  Roles:                          │
│  • Owner (HQ)                    │  │  • Owner (HQ)                    │
│  • Manager (BRANCH)              │  │  • Vet (BRANCH, provider)        │
│  • Barber (BRANCH, provider)     │  │  • Groomer (BRANCH, provider)    │
│  • Jr Barber (BRANCH, provider)  │  │  • Receptionist (BRANCH)         │
│  • Cashier (BRANCH)              │  │  • Pet Owner (CUSTOMER)          │
│  • Customer (CUSTOMER)           │  │                                  │
│                                  │  │  Services:                       │
│  Services:                       │  │  • Vaccination (Vet only)        │
│  • Haircut (all barbers)         │  │  • Grooming (Groomer only)       │
│  • Shave (all barbers)           │  │  • Check-up (Vet only)           │
│  • Hair Color (Master only)      │  │  • Bath (Groomer only)           │
│                                  │  │                                  │
│  Tax: PPN 11%, inclusive         │  │  Tax: PPN 11%, inclusive          │
│  Currency: IDR                   │  │  Currency: IDR                    │
│                                  │  │                                  │
│  Frontend: @tmng/barber-*        │  │  Frontend: @tmng/vet-* (future)  │
│  API:      @tmng/saas-api ◄──────┼──┼──▶ API: @tmng/saas-api           │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

## 11. Namespace Convention

| Package | Name | Layer |
|---------|------|-------|
| API | `@tmng/saas-api` | Platform (generic) |
| Admin | `@tmng/barber-admin` | Product (barbershop skin) |
| Client | `@tmng/barber-client` | Product (barbershop skin) |
| Docker | `tmng-saas-api` | Infrastructure |
| DB | `tmng_saas_db` | Infrastructure |
| Deploy path | `/opt/tmng-saas/` | Infrastructure |

Future products follow the pattern:
- `@tmng/vet-admin`, `@tmng/vet-client`
- `@tmng/massage-admin`, `@tmng/massage-client`

## 12. Organization Settings

Each org carries its own configuration:

**Tax**: `taxEnabled`, `taxRate` (decimal), `taxName` (PPN/VAT/GST), `taxInclusive` (price includes tax or added on top)

**Currency & Locale**: `currency` (ISO 4217), `currencySymbol`, `timezone` (IANA), `locale` (BCP 47)

**Business Defaults**: `tipDistribution` (PER_STAFF/POOLED), `maxDiscountPercent`, `autoNoShowMinutes`, `autoClockOutTime`, `defaultBookingBuffer`, `requireVoidApproval`

**Loyalty**: `loyaltyEnabled`, `loyaltyPointsPerCurrency`, `loyaltyRedemptionRate`

**Branch overrides**: `tipDistribution` and `maxDiscountPercent` can be overridden per branch (null = use org default).
