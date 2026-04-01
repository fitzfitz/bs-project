# Barbershop Template — TMNG Platform

> Industry template that maps the generic TMNG SaaS platform to a barbershop business. Covers role mapping, service catalog, configuration defaults, full seed data reference, workflow examples, and onboarding.
>
> For generic platform logic, see [business_logic.md](../business_logic.md). For the full feature catalog, see [features.md](../features.md).

---

## 1. Industry Overview

A barbershop is an appointment-based service business where:

- **Providers** are called **Barbers** — they perform services like haircuts, shaves, and grooming treatments
- **Stations** are called **Chairs** — each barber works at a chair
- **Services** include standard cuts, specialty styling, beard work, treatments, and retail products (pomade, shampoo, aftershave)
- Revenue is driven by service volume, retail sales, and tips
- Walk-in customers are common alongside online bookings, making queue management critical

### How Generic Platform Concepts Map to Barbershop

| Platform Concept | Barbershop Equivalent |
|---|---|
| Provider / Staff Member | Barber |
| Station | Chair |
| Service A, Service B | Haircut, Shave |
| Add-on A, Add-on B | Hot Towel, Head Massage |
| Premium Package (combo) | Haircut + Shave Combo |
| Senior Tier | Master Barber |
| Standard Tier | Senior Barber |
| Junior Tier | Junior Barber |
| Station Utilization | Chair Utilization |
| Service Time | Cutting Time |

---

## 2. Role Mapping

| Generic Role | Barbershop Role | Scope | Service Provider? | Notes |
|---|---|---|---|---|
| Owner | Owner | HQ | No | Full CRUD on all 25 features. System role. |
| Manager | Manager | BRANCH | No | Manages branch ops. Can approve payroll, manage promos. |
| Provider (Tier: Master) | Barber | BRANCH | Yes | Senior provider. Can view queue, manage own attendance/payroll. |
| Provider (Tier: Junior) | Junior Barber | BRANCH | Yes | Limited service permissions (e.g., Haircut & Shave only). Inherits Barber RBAC matrix. |
| Cashier | Cashier | BRANCH | No | Handles POS transactions, queue management, cash drawer. |
| Customer | Customer | CUSTOMER | No | Books appointments, earns loyalty points, leaves reviews. System role (default for new signups). |

### Permission Matrix (Barbershop)

Notation: C=Create, R=Read, U=Update, D=Delete, `–` = no access.

| Feature | Owner | Manager | Barber | Cashier | Customer |
|---|---|---|---|---|---|
| Queue Management | CRUD | CRUD | RU | CRU | – |
| Booking | CRUD | CRUD | – | – | CRU |
| Staff Management | CRUD | RU | – | – | – |
| Branch Management | CRUD | RU | – | – | – |
| Service Catalog | CRUD | CRUD | – | – | R |
| Attendance | CRUD | CRUD | CRU | – | – |
| POS / Payments | CRUD | CRUD | – | CRU | – |
| Cash Drawer | CRUD | CRU | – | CRU | – |
| Inventory | CRUD | CRUD | – | R | – |
| Commission | CRUD | CRU | R | – | – |
| Payroll | CRUD | CRU | RU | – | – |
| Finance Reports | CRUD | R | – | – | – |
| Analytics | CRUD | R | – | – | – |
| Reports | CRUD | CR | – | – | – |
| Loyalty | CRUD | CRU | – | – | R |
| Promotions | CRUD | CRUD | – | – | – |
| Reviews | CRUD | RU | – | – | CRUD |
| Referrals | CRUD | R | – | – | CR |
| Campaigns | CRUD | CRU | – | – | – |
| CRM | CRUD | R | – | – | – |
| Retention | CRUD | R | – | – | – |
| Audit Trail | R | R | – | – | – |
| User Management | CRUD | CRU | – | – | – |
| Role Management | CRUD | R | – | – | – |
| Org Settings | CRUD | R | – | – | – |

---

## 3. Service Catalog Examples

### 3.1. Standard Services

| Service | Category | Base Price (IDR) | Duration | Buffer | Description |
|---|---|---|---|---|---|
| Haircut | HAIRCUT | 80,000 | 30 min | 5 min | Classic men's haircut with consultation and styling |
| Shave | SHAVE | 50,000 | 20 min | 5 min | Traditional straight razor shave with hot towel |
| Hair Coloring | TREATMENT | 200,000 | 60 min | 10 min | Full hair coloring with premium products |

### 3.2. Add-Ons

| Add-On | Base Price (IDR) | Duration | Notes |
|---|---|---|---|
| Hot Towel | 15,000 | 5 min | Relaxing hot towel facial treatment |
| Head Massage | 20,000 | 5 min | Scalp and head massage |

### 3.3. Combo Packages

| Combo | Included Services | Combo Price | Individual Total | Savings |
|---|---|---|---|---|
| Haircut + Shave Combo | Haircut + Shave | 120,000 | 130,000 | 10,000 |

### 3.4. Tier Surcharges

| Service | Senior (+) | Master (+) |
|---|---|---|
| Haircut | +15,000 | +30,000 |
| Shave | +10,000 | +20,000 |
| Hair Coloring | +25,000 | +50,000 |

**Example final price:** Haircut by a Master barber = 80,000 (base) + 30,000 (surcharge) = **110,000 IDR**.

### 3.5. Role-Service Restrictions

| Role | Allowed Services |
|---|---|
| Barber (Master/Senior) | All services |
| Junior Barber | Haircut, Shave only |

---

## 4. Configuration Defaults

### 4.1. Organization Settings

| Setting | Value | Notes |
|---|---|---|
| Industry Type | BARBERSHOP | Selects industry template |
| Currency | IDR | Indonesian Rupiah |
| Currency Symbol | Rp | Display prefix |
| Locale | id-ID | Indonesian locale for formatting |
| Timezone | Asia/Jakarta | WIB (UTC+7) |
| Tax Enabled | true | PPN (Indonesian VAT) |
| Tax Name | PPN | |
| Tax Rate | 11% | Applied to transactions |
| Tax Inclusive | true | Prices shown include tax |

### 4.2. Platform Config Values

| Key | Value | Description |
|---|---|---|
| POINTS_EARN_RATE | 10,000 | Earn 1 point per 10,000 IDR spent |
| POINTS_REDEEM_RATE | 500 | 1 point = 500 IDR discount |
| POINTS_EXPIRY_MONTHS | 6 | Points expire after 6 months inactivity |
| MAX_REDEMPTION_PERCENT | 50 | Max 50% of bill payable by points |
| REFERRAL_BONUS_POINTS | 50 | Points awarded to referrer on completion |
| REFERRAL_EXPIRY_DAYS | 30 | Referral expires 30 days after applied |
| CASHIER_DISCOUNT_LIMIT | 10 | Cashier can discount up to 10% without approval |
| TAX_RATE | 12 | Default tax rate (org can override) |
| COMMISSION_RATE_MASTER | 40 | 40% commission for Master tier |
| COMMISSION_RATE_SENIOR | 35 | 35% commission for Senior tier |
| COMMISSION_RATE_JUNIOR | 30 | 30% commission for Junior tier |
| PREPAYMENT_ENABLED | false | No deposit required at booking |
| DEPOSIT_PERCENTAGE | 100 | If enabled, full prepayment |
| CANCELLATION_POLICY_HOURS | 0 | No penalty window |
| CANCELLATION_PENALTY_PERCENTAGE | 0 | No cancellation fee |
| WAITLIST_ENABLED | false | Waitlist not active by default |
| WAITLIST_MAX_PER_SLOT | 5 | Max waitlist entries per time slot |

### 4.3. Surge Pricing Rules

| Branch | Day | Hours | Multiplier |
|---|---|---|---|
| Central Jakarta | Saturday | 10:00–14:00 | 1.20x |
| Central Jakarta | Sunday | 10:00–14:00 | 1.15x |

### 4.4. Operating Hours

| Day | Central Jakarta | Kemang |
|---|---|---|
| Mon–Fri | 09:00–21:00 | 09:00–21:00 |
| Saturday | 08:00–22:00 | 08:00–22:00 |
| Sunday | 10:00–20:00 | 10:00–20:00 |

---

## 5. Seed Data Reference

> Maps directly to Stage 2 of `apps/api/prisma/seed.ts`. Each entity includes a WHY column explaining its purpose for development and testing.

### 5.1. Organization

| Field | Value | WHY |
|---|---|---|
| Name | Budi's Barbershop | Demonstrates IDR multi-tenant barbershop config |
| Slug | budis-barbershop | URL-friendly org identifier |
| Industry | BARBERSHOP | Selects barbershop industry template |
| Tax | PPN 11% (inclusive) | Tests Indonesian tax handling |
| Currency | IDR / Rp / id-ID | Tests IDR currency formatting |
| Timezone | Asia/Jakarta | Tests WIB (UTC+7) conversion |
| Auto No-Show | 15 min | Tests queue no-show timeout |
| Max Discount | 50% | Tests discount validation |
| Loyalty | Enabled, 1 pt/IDR, 100 IDR redeem | Tests loyalty accumulation and redemption |

### 5.2. Branches (2)

| Branch | City | Email | WHY |
|---|---|---|---|
| Barber Central Jakarta | Jakarta Pusat | central@barberproject.id | Primary branch — surge rules, full inventory, most staff |
| Barber Kemang | Jakarta Selatan | kemang@barberproject.id | Secondary branch — tests branch service price override, branch-scoped promo |

### 5.3. Roles (6)

| Role | Scope | System? | Provider? | WHY |
|---|---|---|---|---|
| Owner | HQ | Yes | No | Full access. Tests HQ-scope RBAC. |
| Manager | BRANCH | No | No | Tests branch-level management permissions |
| Barber | BRANCH | No | Yes | Standard provider. Tests service assignment, commission, attendance. |
| Junior Barber | BRANCH | No | Yes | Limited provider. Tests restricted service access (inherits Barber RBAC). |
| Cashier | BRANCH | No | No | Tests POS/queue access without provider capabilities |
| Customer | CUSTOMER | Yes | No | Default role for signups. Tests booking, loyalty, reviews. |

### 5.4. Users (8)

| Email | Role | Branch | Name | WHY |
|---|---|---|---|---|
| owner@barber.com | Owner | — (HQ) | Super Admin | Tests owner-level operations across all branches |
| manager@barber.com | Manager | Central | Andi Wijaya | Tests branch management, payroll approval |
| cashier@barber.com | Cashier | Central | Dewi Sari | Tests POS checkout, cash drawer, queue management |
| budi@barber.com | Barber | Central | Budi Gunawan | Master tier — tests highest surcharge and commission |
| rudi@barber.com | Barber | Central | Rudi Hermawan | Senior tier — tests mid-tier pricing and commission |
| agus@barber.com | Jr. Barber | Kemang | Agus Pratama | Junior tier at different branch — tests service restrictions and cross-branch |
| customer1@gmail.com | Customer | — | Rizky Firmansyah | Tests booking, loyalty (50 pts, BRONZE), low churn risk |
| customer2@gmail.com | Customer | — | Dimas Pradana | Tests loyalty, high churn risk (0.72 score) |

**All passwords:** `Password123!`

### 5.5. Staff Profiles (3)

| User | Tier | Commission Model | Rate | Specialties | WHY |
|---|---|---|---|---|---|
| Budi Gunawan | MASTER | Flat % | 50% | Fade, Textured Crop, Pompadour | Tests highest commission rate and tier surcharge |
| Rudi Hermawan | SENIOR | Flat % | 45% | Classic Cut, Straight Razor Shave, Beard Trim | Tests mid-tier commission and surcharge |
| Agus Pratama | JUNIOR | Flat % | 40% | Kids Cut, Basic Fade | Tests lowest tier, OFF_DUTY status, restricted services |

### 5.6. Customer Memberships (2)

| Customer | Tier | Points Balance | Lifetime Points | WHY |
|---|---|---|---|---|
| Rizky Firmansyah | BRONZE | 50 | 50 | Tests loyalty redemption with active balance |
| Dimas Pradana | BRONZE | 50 | 50 | Tests loyalty + high churn scenario |

### 5.7. Services (6)

| Name | Type | Category | Price (IDR) | Duration | WHY |
|---|---|---|---|---|---|
| Haircut | STANDARD | HAIRCUT | 80,000 | 30+5 min | Core service — most bookings, all tier surcharges |
| Shave | STANDARD | SHAVE | 50,000 | 20+5 min | Secondary service — combo component, Junior eligible |
| Hair Coloring | STANDARD | TREATMENT | 200,000 | 60+10 min | High-value service — tests large surcharges |
| Hot Towel | ADD_ON | TREATMENT | 15,000 | 5 min | Tests add-on pricing (no surge/surcharge) |
| Head Massage | ADD_ON | TREATMENT | 20,000 | 5 min | Second add-on for multi-addon testing |
| Haircut + Shave Combo | COMBO | COMBO | 120,000 | 45+5 min | Tests combo pricing, single queue entry, savings display |

### 5.8. Branch Service Override (1)

| Branch | Service | Override Price | WHY |
|---|---|---|---|
| Kemang | Haircut | 90,000 (vs 80,000 global) | Tests per-branch pricing — premium location markup |

### 5.9. Promo Codes (3)

| Code | Type | Value | Min Basket | Max Discount | Branch | Limit | WHY |
|---|---|---|---|---|---|---|---|
| WELCOME2026 | PERCENTAGE | 15% | 50,000 | 30,000 | All | 100 | Tests percentage promo with cap |
| DISKON10K | FIXED | 10,000 | 50,000 | — | All | 50 | Tests fixed-amount promo |
| KEMANGVIP | PERCENTAGE | 20% | 80,000 | 50,000 | Kemang only | 30 | Tests branch-scoped promo |

### 5.10. Products & Inventory

**Products (3):**

| Product | SKU | Cost (IDR) | Sell (IDR) | Margin | WHY |
|---|---|---|---|---|---|
| Premium Pomade | PROD-POMADE-001 | 35,000 | 75,000 | 114% | Tests high-margin retail item |
| Anti-Dandruff Shampoo | PROD-SHAMPOO-001 | 25,000 | 55,000 | 120% | Tests mid-range product |
| Aftershave Balm | PROD-AFTERSHAVE-001 | 20,000 | 45,000 | 125% | Tests product only at Central (not in Kemang inventory) |

**Branch Inventory (5):**

| Branch | Product | Qty | Reorder At | WHY |
|---|---|---|---|---|
| Central | Pomade | 20 | 5 | Tests normal stock level |
| Central | Shampoo | 15 | 5 | Tests normal stock level |
| Central | Aftershave | 10 | 3 | Tests lower reorder threshold |
| Kemang | Pomade | 12 | 5 | Tests cross-branch inventory comparison |
| Kemang | Shampoo | 8 | 5 | Tests stock near reorder threshold |

### 5.11. AI/ML Sample Data

**Demand Forecasts (3):**

| Branch | Day | Predicted Txs | Predicted Revenue | Confidence Range | WHY |
|---|---|---|---|---|---|
| Central | Today | 25 | 2,500,000 | 2M–3M | Baseline demand prediction |
| Central | Tomorrow | 30 | 3,000,000 | 2.4M–3.6M | Higher demand — tests scheduling suggestion |
| Central | Day After | 18 | 1,800,000 | 1.4M–2.2M | Lower demand — tests reduce-staff suggestion |

**Schedule Suggestions (2):**

| Branch | Day | Shift | Reason | Status | WHY |
|---|---|---|---|---|---|
| Central | Tomorrow | 10:00–14:00 | 40% above capacity | PENDING | Tests pending suggestion display |
| Central | Day After | 14:00–18:00 | Weekend surge expected | ACCEPTED | Tests accepted suggestion (auto-creates shift) |

**Churn Scores (2):**

| Customer | Score | Risk | Features | WHY |
|---|---|---|---|---|
| Rizky Firmansyah | 0.25 | LOW | Recency: 5d, Freq: 8, Monetary: 180K | Tests healthy customer display |
| Dimas Pradana | 0.72 | HIGH | Recency: 45d, Freq: 2, Monetary: 80K | Tests at-risk customer flagging and retention targeting |

---

## 6. Workflow Examples

### 6.1. Walk-in Haircut by a Master Barber

1. Customer walks into Central Jakarta branch
2. Cashier (Dewi) adds customer to queue — selects "Haircut" service
3. System auto-assigns to Budi (Master barber, shortest queue)
4. Queue status: **WAITING**
5. Budi finishes current client → system transitions to **CALLED**
6. Push notification sent to customer: "Your Turn Is Coming!"
7. Customer sits down → **IN_SERVICE**
8. Budi completes haircut (30 min) → **COMPLETED**
9. Customer moves to POS → **AT_CHECKOUT**
10. Price resolution: 80,000 (base) + 30,000 (Master surcharge) = **110,000 IDR**
11. Customer adds Hot Towel add-on: +15,000 = **125,000 IDR**
12. Tax (PPN 11% inclusive — already in price)
13. Customer pays QRIS via Xendit → **PAID**
14. Budi earns: 110,000 × 50% = **55,000 IDR commission** (on service revenue, excluding add-on/product)
15. Customer earns: FLOOR(125,000 / 10,000) = **12 loyalty points**

### 6.2. Online Booking with Surge Pricing

1. Customer opens app, selects Central Jakarta, Saturday 11:00 AM
2. Selects "Shave" service, prefers Rudi (Senior barber)
3. Price resolution:
   - Base: 50,000
   - Surge (Saturday 10–14, 1.2x): 50,000 × 1.2 = 60,000
   - Senior surcharge: +10,000
   - **Total: 70,000 IDR**
4. Slot available → booking CONFIRMED
5. Saturday 10:35 AM: Push reminder "Your appointment is in ~25 minutes"
6. Customer arrives → queue entry transitions through WAITING → CALLED → IN_SERVICE → COMPLETED → PAID

### 6.3. Promo Code at Kemang Branch

1. Customer at Kemang branch with Haircut (90,000 — branch override) + Shave (50,000) = 140,000 gross
2. Applies code "KEMANGVIP" (20% off, branch-scoped to Kemang, max 50,000 discount)
3. Discount: 140,000 × 20% = 28,000 IDR (under max cap)
4. Net: 140,000 - 28,000 = **112,000 IDR** (before tax)

### 6.4. Cash Drawer Shift

1. Cashier (Dewi) opens drawer at 09:00 with opening balance: 500,000 IDR
2. Throughout the day, entries are recorded:
   - SALE: +80,000 (haircut)
   - SALE: +120,000 (combo)
   - PAYOUT: -50,000 (petty cash for supplies)
3. At close (21:00), Dewi counts: 655,000 IDR in drawer
4. Expected: 500,000 + 80,000 + 120,000 - 50,000 = 650,000
5. Discrepancy: 655,000 - 650,000 = **+5,000 (overage)** — noted and session closed

---

## 7. Onboarding Guide

Step-by-step to set up a new barbershop organization from scratch using the TMNG platform.

### Step 1: Create Organization

```
POST /api/platform/organizations
{
  "name": "Your Barbershop Name",
  "slug": "your-barbershop",
  "industryType": "BARBERSHOP",
  "currency": "IDR",
  "currencySymbol": "Rp",
  "locale": "id-ID",
  "timezone": "Asia/Jakarta"
}
```

This auto-creates roles from the BARBERSHOP industry template: Owner, Manager, Barber, Junior Barber, Cashier, Customer.

### Step 2: Configure Tax & Business Rules

Via admin dashboard or API:
- Enable/disable tax (PPN), set rate and inclusive/exclusive
- Set loyalty program parameters (earn rate, redeem rate, expiry)
- Configure commission rates per tier
- Set auto-no-show timeout, booking buffer, max discount

### Step 3: Create Branches

For each physical location:
- Name, address, city, phone, email
- Set operating hours per day of week
- Optionally configure surge pricing rules
- Upload branch image

### Step 4: Create Service Catalog

As Super Admin / Owner:
1. Create standard services (Haircut, Shave, etc.) with base price and duration
2. Create add-on services (Hot Towel, Massage) — flat price, no surge/surcharge
3. Create combo packages linking standard services
4. Add tier surcharges per service (Junior, Senior, Master)
5. Optionally create branch service overrides for premium locations

### Step 5: Invite Staff

1. Create user accounts for managers, barbers, cashiers
2. Assign appropriate tenant roles
3. Assign to branches
4. Create staff profiles for service providers (barbers):
   - Set tier (JUNIOR, SENIOR, MASTER)
   - Set commission model and rate
   - Add bio and specialties
5. Configure role-service assignments (e.g., Junior Barbers can only do Haircut + Shave)

### Step 6: Set Up Inventory (Optional)

- Add retail products (pomade, shampoo, etc.) with cost and sell price
- Set initial stock levels per branch
- Configure reorder thresholds for low-stock alerts

### Step 7: Configure Promos & Loyalty

- Create promo codes (percentage or fixed, with optional branch scope)
- Verify loyalty configuration (earn rate, tiers, expiry)
- Set up referral program parameters

### Step 8: Go Live

- Staff clock in via attendance system
- Customers can now book online or walk in
- POS processes transactions with commission tracking
- Dashboard shows real-time analytics

---

## 8. Adapting for a New Industry

This section serves as a checklist for creating the next industry template (e.g., vet clinic, spa, nail salon).

### 8.1. What Changes (Industry-Specific)

| Area | What to Define |
|---|---|
| **Industry Template** | New entry in `IndustryTemplate` with `industryType`, `defaultRoles`, `defaultServices`, `defaultPermissions` |
| **Role Names** | Map generic roles to industry terms (e.g., "Veterinarian" instead of "Barber") |
| **Service Categories** | Define categories relevant to the industry (e.g., "CHECKUP", "VACCINATION" for vet) |
| **Service Catalog** | Create services with appropriate pricing, durations, and add-ons |
| **Tier Names** | Map tiers to industry (e.g., "Specialist" instead of "Master") |
| **Seed Data (Stage 2)** | Create a new tenant seed block in `seed.ts` or a separate seed file |
| **Template Doc** | Create `docs/templates/<industry>.md` following this same structure |
| **Frontend Skin** | New app under `apps/` (e.g., `@tmng/vet-admin`, `@tmng/vet-client`) with industry branding |

### 8.2. What Stays the Same (Platform)

- All 25 features and their CRUD operations
- RBAC permission model (just different role names)
- Queue state machine (WAITING → CALLED → IN_SERVICE → COMPLETED → PAID)
- POS calculation formulas (gross, discount, tax, net, commission)
- Loyalty points engine (earn, redeem, tiers, expiry)
- Commission models (Flat %, Sliding Scale, Base + Bonus)
- Inventory management (stock movement, COGS, reorder alerts)
- Notification system (push, in-app, email channels)
- CRM segmentation rules (VIP, Regular, New, At-Risk, Lapsed)
- Report types (daily revenue, service popularity, staff leaderboard, customer visits, booking source)
- Audit trail and anomaly detection
- Multi-currency and timezone handling
- Demand forecasting and smart scheduling algorithms
- Stage 1 seed data (features, templates, platform admin, config)

### 8.3. Example: Vet Clinic Adaptation

| Barbershop | Vet Clinic |
|---|---|
| Barber | Veterinarian |
| Junior Barber | Vet Tech |
| Haircut | Checkup |
| Shave | Vaccination |
| Hair Coloring | Dental Cleaning |
| Hot Towel (add-on) | Nail Trim (add-on) |
| Pomade (product) | Flea Treatment (product) |
| Chair | Exam Room |
| Master tier | Specialist |
| Senior tier | General Practice |
| Junior tier | Intern |
