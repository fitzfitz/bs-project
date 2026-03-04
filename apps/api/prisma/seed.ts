/// <reference types="node" />
import "dotenv/config";
/**
 * TMNG SaaS Platform — Database Seeder
 *
 * Two-stage seed:
 *   1. Platform seed — Features, IndustryTemplates, PlatformAdmin (global)
 *   2. Dev tenant seed — Barbershop org with roles, branches, users, services, etc.
 *
 * Usage:
 *   pnpm --filter @tmng/saas-api db:seed
 *   — or —
 *   npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
function log(emoji: string, msg: string) {
  console.log(`  ${emoji}  ${msg}`);
}

// =============================================================================
// Feature Catalog (25 features)
// =============================================================================

const FEATURES = [
  { code: "QUEUE_MANAGEMENT", name: "Queue / Walk-in Management", module: "CORE" as const, sortOrder: 1 },
  { code: "BOOKING", name: "Appointment Booking", module: "CORE" as const, sortOrder: 2 },
  { code: "STAFF_MANAGEMENT", name: "Staff Profiles & Assignment", module: "CORE" as const, sortOrder: 3 },
  { code: "BRANCH_MANAGEMENT", name: "Branch Settings & Config", module: "CORE" as const, sortOrder: 4 },
  { code: "SERVICE_CATALOG", name: "Services & Pricing", module: "CORE" as const, sortOrder: 5 },
  { code: "ATTENDANCE", name: "Clock In/Out & Shifts", module: "OPS" as const, sortOrder: 6 },
  { code: "TRANSACTION", name: "POS / Payments", module: "OPS" as const, sortOrder: 7 },
  { code: "CASH_DRAWER", name: "Cash Reconciliation", module: "OPS" as const, sortOrder: 8 },
  { code: "INVENTORY", name: "Product Inventory", module: "OPS" as const, sortOrder: 9 },
  { code: "COMMISSION", name: "Commission Calculation", module: "FINANCE" as const, sortOrder: 10 },
  { code: "PAYROLL", name: "Payroll Processing", module: "FINANCE" as const, sortOrder: 11 },
  { code: "FINANCE_REPORTS", name: "Financial Reports", module: "FINANCE" as const, sortOrder: 12 },
  { code: "ANALYTICS", name: "Dashboard & Charts", module: "INTEL" as const, sortOrder: 13 },
  { code: "REPORTS", name: "Export Reports", module: "INTEL" as const, sortOrder: 14 },
  { code: "LOYALTY", name: "Loyalty Program", module: "ENGAGE" as const, sortOrder: 15 },
  { code: "PROMOTIONS", name: "Promo Codes", module: "ENGAGE" as const, sortOrder: 16 },
  { code: "REVIEWS", name: "Customer Reviews", module: "ENGAGE" as const, sortOrder: 17 },
  { code: "REFERRALS", name: "Referral System", module: "ENGAGE" as const, sortOrder: 18 },
  { code: "CAMPAIGNS", name: "Marketing Campaigns", module: "ENGAGE" as const, sortOrder: 19 },
  { code: "CRM", name: "Customer Management", module: "ENGAGE" as const, sortOrder: 20 },
  { code: "RETENTION", name: "Retention Analytics", module: "ENGAGE" as const, sortOrder: 21 },
  { code: "AUDIT_LOG", name: "Audit Trail", module: "ADMIN" as const, sortOrder: 22 },
  { code: "USER_MANAGEMENT", name: "User CRUD", module: "ADMIN" as const, sortOrder: 23 },
  { code: "ROLE_MANAGEMENT", name: "Role & Permission Config", module: "ADMIN" as const, sortOrder: 24 },
  { code: "ORG_SETTINGS", name: "Organization Settings", module: "ADMIN" as const, sortOrder: 25 },
];

// =============================================================================
// Permission matrix per role (from rbac_system.md)
// Key: C=canCreate R=canRead U=canUpdate D=canDelete
// =============================================================================

type Perms = { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean };
function p(c: boolean, r: boolean, u: boolean, d: boolean): Perms {
  return { canCreate: c, canRead: r, canUpdate: u, canDelete: d };
}
const _ = p(false, false, false, false);
const CRUD = p(true, true, true, true);
const CRU = p(true, true, true, false);
const CR = p(true, true, false, false);
const R = p(false, true, false, false);
const RU = p(false, true, true, false);

const PERMISSION_MATRIX: Record<string, Record<string, Perms>> = {
  Owner: {
    QUEUE_MANAGEMENT: CRUD, BOOKING: CRUD, STAFF_MANAGEMENT: CRUD, BRANCH_MANAGEMENT: CRUD,
    SERVICE_CATALOG: CRUD, ATTENDANCE: CRUD, TRANSACTION: CRUD, CASH_DRAWER: CRUD,
    INVENTORY: CRUD, COMMISSION: CRUD, PAYROLL: CRUD, FINANCE_REPORTS: CRUD,
    ANALYTICS: CRUD, REPORTS: CRUD, LOYALTY: CRUD, PROMOTIONS: CRUD,
    REVIEWS: CRUD, REFERRALS: CRUD, CAMPAIGNS: CRUD, CRM: CRUD, RETENTION: CRUD,
    AUDIT_LOG: R, USER_MANAGEMENT: CRUD, ROLE_MANAGEMENT: CRUD, ORG_SETTINGS: CRUD,
  },
  Manager: {
    QUEUE_MANAGEMENT: CRUD, BOOKING: CRUD, STAFF_MANAGEMENT: RU, BRANCH_MANAGEMENT: RU,
    SERVICE_CATALOG: CRUD, ATTENDANCE: CRUD, TRANSACTION: CRUD, CASH_DRAWER: CRU,
    INVENTORY: CRUD, COMMISSION: CRU, PAYROLL: CRU, FINANCE_REPORTS: R,
    ANALYTICS: R, REPORTS: CR, LOYALTY: CRU, PROMOTIONS: CRUD,
    REVIEWS: RU, REFERRALS: R, CAMPAIGNS: CRU, CRM: R, RETENTION: R,
    AUDIT_LOG: R, USER_MANAGEMENT: CRU, ROLE_MANAGEMENT: R, ORG_SETTINGS: R,
  },
  Barber: {
    QUEUE_MANAGEMENT: RU, BOOKING: _, STAFF_MANAGEMENT: _, BRANCH_MANAGEMENT: _,
    SERVICE_CATALOG: _, ATTENDANCE: CR, TRANSACTION: _, CASH_DRAWER: _,
    INVENTORY: _, COMMISSION: R, PAYROLL: R, FINANCE_REPORTS: _,
    ANALYTICS: _, REPORTS: _, LOYALTY: _, PROMOTIONS: _,
    REVIEWS: _, REFERRALS: _, CAMPAIGNS: _, CRM: _, RETENTION: _,
    AUDIT_LOG: _, USER_MANAGEMENT: _, ROLE_MANAGEMENT: _, ORG_SETTINGS: _,
  },
  Cashier: {
    QUEUE_MANAGEMENT: CRU, BOOKING: _, STAFF_MANAGEMENT: _, BRANCH_MANAGEMENT: _,
    SERVICE_CATALOG: _, ATTENDANCE: _, TRANSACTION: CRU, CASH_DRAWER: CRU,
    INVENTORY: R, COMMISSION: _, PAYROLL: _, FINANCE_REPORTS: _,
    ANALYTICS: _, REPORTS: _, LOYALTY: _, PROMOTIONS: _,
    REVIEWS: _, REFERRALS: _, CAMPAIGNS: _, CRM: _, RETENTION: _,
    AUDIT_LOG: _, USER_MANAGEMENT: _, ROLE_MANAGEMENT: _, ORG_SETTINGS: _,
  },
  Customer: {
    QUEUE_MANAGEMENT: _, BOOKING: CRU, STAFF_MANAGEMENT: _, BRANCH_MANAGEMENT: _,
    SERVICE_CATALOG: R, ATTENDANCE: _, TRANSACTION: _, CASH_DRAWER: _,
    INVENTORY: _, COMMISSION: _, PAYROLL: _, FINANCE_REPORTS: _,
    ANALYTICS: _, REPORTS: _, LOYALTY: R, PROMOTIONS: _,
    REVIEWS: CRUD, REFERRALS: CR, CAMPAIGNS: _, CRM: _, RETENTION: _,
    AUDIT_LOG: _, USER_MANAGEMENT: _, ROLE_MANAGEMENT: _, ORG_SETTINGS: _,
  },
};

// =============================================================================
// Main Seed
// =============================================================================

async function main() {
  console.log("\n  Seeding TMNG SaaS Platform database...\n");

  // -------------------------------------------------------------------------
  // STAGE 1: Platform Seed (global)
  // -------------------------------------------------------------------------
  log("*", "STAGE 1: Platform-level data");

  // 1a. Features
  log(">", "Seeding 25 features...");
  for (const f of FEATURES) {
    await prisma.feature.upsert({
      where: { code: f.code },
      update: { name: f.name, module: f.module, sortOrder: f.sortOrder },
      create: f,
    });
  }
  log("+", `${FEATURES.length} features seeded`);

  // 1b. Industry Templates
  log(">", "Seeding industry templates...");
  const TEMPLATES = [
    {
      industryType: "BARBERSHOP" as const,
      name: "Barbershop",
      description: "Full-service barbershop with queue, booking, loyalty, and staff management",
      templateData: {
        defaultRoles: [
          { name: "Owner", scope: "HQ", isServiceProvider: false, isSystemRole: true },
          { name: "Manager", scope: "BRANCH", isServiceProvider: false },
          { name: "Barber", scope: "BRANCH", isServiceProvider: true },
          { name: "Junior Barber", scope: "BRANCH", isServiceProvider: true },
          { name: "Cashier", scope: "BRANCH", isServiceProvider: false },
          { name: "Customer", scope: "CUSTOMER", isServiceProvider: false, isSystemRole: true },
        ],
        defaultServices: ["Haircut", "Shave", "Hair Coloring", "Hot Towel"],
      },
    },
    {
      industryType: "BEAUTY_SALON" as const,
      name: "Beauty Salon",
      description: "Salon with appointment-based service delivery",
      templateData: {
        defaultRoles: [
          { name: "Owner", scope: "HQ", isServiceProvider: false, isSystemRole: true },
          { name: "Stylist", scope: "BRANCH", isServiceProvider: true },
          { name: "Receptionist", scope: "BRANCH", isServiceProvider: false },
          { name: "Customer", scope: "CUSTOMER", isServiceProvider: false, isSystemRole: true },
        ],
      },
    },
    {
      industryType: "SPA" as const,
      name: "Spa & Wellness",
      description: "Spa with therapist scheduling and treatment packages",
      templateData: {
        defaultRoles: [
          { name: "Owner", scope: "HQ", isServiceProvider: false, isSystemRole: true },
          { name: "Therapist", scope: "BRANCH", isServiceProvider: true },
          { name: "Receptionist", scope: "BRANCH", isServiceProvider: false },
          { name: "Customer", scope: "CUSTOMER", isServiceProvider: false, isSystemRole: true },
        ],
      },
    },
    {
      industryType: "VET_CLINIC" as const,
      name: "Veterinary Clinic",
      description: "Vet clinic with appointment booking and patient records",
      templateData: {
        defaultRoles: [
          { name: "Owner", scope: "HQ", isServiceProvider: false, isSystemRole: true },
          { name: "Veterinarian", scope: "BRANCH", isServiceProvider: true },
          { name: "Vet Tech", scope: "BRANCH", isServiceProvider: true },
          { name: "Receptionist", scope: "BRANCH", isServiceProvider: false },
          { name: "Customer", scope: "CUSTOMER", isServiceProvider: false, isSystemRole: true },
        ],
      },
    },
  ];

  for (const t of TEMPLATES) {
    await prisma.industryTemplate.upsert({
      where: { industryType: t.industryType },
      update: { name: t.name, description: t.description, templateData: t.templateData },
      create: t,
    });
  }
  log("+", `${TEMPLATES.length} industry templates seeded`);

  // 1c. Platform Admin
  log(">", "Seeding platform admin...");
  const adminHash = await hashPassword("PlatformAdmin123!");
  await prisma.platformAdmin.upsert({
    where: { email: "admin@tmng.dev" },
    update: {},
    create: {
      email: "admin@tmng.dev",
      passwordHash: adminHash,
      firstName: "TMNG",
      lastName: "Admin",
      role: "PLATFORM_ADMIN",
    },
  });
  log("+", "Platform admin: admin@tmng.dev / PlatformAdmin123!");

  // -------------------------------------------------------------------------
  // STAGE 2: Barbershop Dev Tenant
  // -------------------------------------------------------------------------
  log("*", "STAGE 2: Dev barbershop tenant");

  // 2a. Organization
  log(">", "Creating organization...");
  const org = await prisma.organization.upsert({
    where: { slug: "budis-barbershop" },
    update: {},
    create: {
      name: "Budi's Barbershop",
      slug: "budis-barbershop",
      industryType: "BARBERSHOP",
      taxEnabled: true,
      taxName: "PPN",
      taxRate: 11,
      taxInclusive: true,
      currency: "IDR",
      currencySymbol: "Rp",
      locale: "id-ID",
      timezone: "Asia/Jakarta",
      autoNoShowMinutes: 15,
      defaultBookingBuffer: 15,
      maxDiscountPercent: 50,
      requireVoidApproval: true,
      loyaltyEnabled: true,
      loyaltyPointsPerCurrency: 1,
      loyaltyRedemptionRate: 100,
    },
  });
  log("+", `Organization: ${org.name} (${org.slug})`);

  // 2b. Tenant Roles
  log(">", "Creating tenant roles...");
  const ROLES_DEF = [
    { name: "Owner", scope: "HQ" as const, isSystemRole: true, isServiceProvider: false, sortOrder: 1 },
    { name: "Manager", scope: "BRANCH" as const, isSystemRole: false, isServiceProvider: false, sortOrder: 2 },
    { name: "Barber", scope: "BRANCH" as const, isSystemRole: false, isServiceProvider: true, sortOrder: 3 },
    { name: "Junior Barber", scope: "BRANCH" as const, isSystemRole: false, isServiceProvider: true, sortOrder: 4 },
    { name: "Cashier", scope: "BRANCH" as const, isSystemRole: false, isServiceProvider: false, sortOrder: 5 },
    { name: "Customer", scope: "CUSTOMER" as const, isSystemRole: true, isServiceProvider: false, sortOrder: 6, isDefault: true },
  ];

  const roles: Record<string, string> = {};
  for (const rd of ROLES_DEF) {
    const role = await prisma.tenantRole.upsert({
      where: { organizationId_name: { organizationId: org.id, name: rd.name } },
      update: {},
      create: { organizationId: org.id, ...rd },
    });
    roles[rd.name] = role.id;
  }
  log("+", `${ROLES_DEF.length} roles created`);

  // 2c. Permission Matrix (batched)
  log(">", "Seeding permission matrix...");
  const permData: Array<{ tenantRoleId: string; featureCode: string; canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }> = [];
  for (const [roleName, roleId] of Object.entries(roles)) {
    const matrixKey = roleName === "Junior Barber" ? "Barber" : roleName;
    const matrix = PERMISSION_MATRIX[matrixKey];
    if (!matrix) continue;
    for (const [featureCode, perms] of Object.entries(matrix)) {
      permData.push({ tenantRoleId: roleId, featureCode, ...perms });
    }
  }
  await prisma.tenantRolePermission.createMany({ data: permData, skipDuplicates: true });
  log("+", `${permData.length} permission entries seeded`);

  // 2d. Branches
  log(">", "Creating branches...");
  const branchCentral = await prisma.branch.upsert({
    where: { id: "branch-central" },
    update: {},
    create: {
      id: "branch-central",
      organizationId: org.id,
      name: "Barber Central Jakarta",
      address: "Jl. M.H. Thamrin No. 1, Menteng",
      city: "Jakarta Pusat",
      phone: "+62215551001",
      email: "central@barberproject.id",
      latitude: -6.1944,
      longitude: 106.8229,
      imageUrl: "https://placehold.co/800x400?text=Central+Jakarta",
    },
  });

  const branchSouth = await prisma.branch.upsert({
    where: { id: "branch-kemang" },
    update: {},
    create: {
      id: "branch-kemang",
      organizationId: org.id,
      name: "Barber Kemang",
      address: "Jl. Kemang Raya No. 45, Bangka",
      city: "Jakarta Selatan",
      phone: "+62215552002",
      email: "kemang@barberproject.id",
      latitude: -6.2615,
      longitude: 106.8106,
      imageUrl: "https://placehold.co/800x400?text=Kemang",
    },
  });
  log("+", "2 branches created");

  // 2e. Operating Hours (batched)
  log(">", "Setting operating hours...");
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
  const hourData = [];
  for (const branch of [branchCentral, branchSouth]) {
    for (const day of days) {
      const isSunday = day === "SUNDAY";
      const isSaturday = day === "SATURDAY";
      hourData.push({
        organizationId: org.id,
        branchId: branch.id,
        dayOfWeek: day,
        openTime: isSunday ? "10:00" : isSaturday ? "08:00" : "09:00",
        closeTime: isSunday ? "20:00" : isSaturday ? "22:00" : "21:00",
        isClosed: false,
      });
    }
  }
  await prisma.operatingHour.deleteMany({ where: { organizationId: org.id } });
  await prisma.operatingHour.createMany({ data: hourData });
  log("+", "14 operating hours set");

  // 2f. Users
  log(">", "Creating users...");
  const pw = await hashPassword("Password123!");

  const usersData = [
    { organizationId: org.id, tenantRoleId: roles["Owner"], email: "owner@barber.com", passwordHash: pw, firstName: "Super", lastName: "Admin", phone: "+6281100000001", isCustomer: false },
    { organizationId: org.id, tenantRoleId: roles["Manager"], email: "manager@barber.com", passwordHash: pw, firstName: "Andi", lastName: "Wijaya", phone: "+6281100000002", isCustomer: false, branchId: branchCentral.id },
    { organizationId: org.id, tenantRoleId: roles["Cashier"], email: "cashier@barber.com", passwordHash: pw, firstName: "Dewi", lastName: "Sari", phone: "+6281100000003", isCustomer: false, branchId: branchCentral.id },
    { organizationId: org.id, tenantRoleId: roles["Barber"], email: "budi@barber.com", passwordHash: pw, firstName: "Budi", lastName: "Gunawan", phone: "+6281100000004", isCustomer: false, branchId: branchCentral.id },
    { organizationId: org.id, tenantRoleId: roles["Barber"], email: "rudi@barber.com", passwordHash: pw, firstName: "Rudi", lastName: "Hermawan", phone: "+6281100000005", isCustomer: false, branchId: branchCentral.id },
    { organizationId: org.id, tenantRoleId: roles["Junior Barber"], email: "agus@barber.com", passwordHash: pw, firstName: "Agus", lastName: "Pratama", phone: "+6281100000006", isCustomer: false, branchId: branchSouth.id },
    { organizationId: org.id, tenantRoleId: roles["Customer"], email: "customer1@gmail.com", passwordHash: pw, firstName: "Rizky", lastName: "Firmansyah", phone: "+6281200000001", isCustomer: true },
    { organizationId: org.id, tenantRoleId: roles["Customer"], email: "customer2@gmail.com", passwordHash: pw, firstName: "Dimas", lastName: "Pradana", phone: "+6281200000002", isCustomer: true },
  ];

  const createdUsers: Record<string, any> = {};
  for (const ud of usersData) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: ud.organizationId, email: ud.email } },
      update: { tenantRoleId: ud.tenantRoleId, branchId: ud.branchId, isCustomer: ud.isCustomer },
      create: ud,
    });
    createdUsers[ud.email] = user;
  }

  const owner = createdUsers["owner@barber.com"];
  const manager = createdUsers["manager@barber.com"];
  const cashier = createdUsers["cashier@barber.com"];
  const barberUser1 = createdUsers["budi@barber.com"];
  const barberUser2 = createdUsers["rudi@barber.com"];
  const barberUser3 = createdUsers["agus@barber.com"];
  const customer1 = createdUsers["customer1@gmail.com"];
  const customer2 = createdUsers["customer2@gmail.com"];

  log("+", "8 users seeded (pw: Password123!)");

  // 2g. Customer Memberships (loyalty)
  log(">", "Creating customer memberships...");
  for (const cust of [customer1, customer2]) {
    await prisma.customerMembership.upsert({
      where: { userId: cust.id },
      update: { pointsBalance: 50, lifetimePoints: 50, tier: "BRONZE" },
      create: {
        organizationId: org.id,
        userId: cust.id,
        pointsBalance: 50,
        lifetimePoints: 50,
        tier: "BRONZE",
      },
    });
  }
  log("+", "2 customer memberships (50 pts each)");

  // 2h. Staff Profiles
  log(">", "Creating staff profiles...");
  await prisma.staffProfile.deleteMany({ where: { organizationId: org.id } });
  const staffBudi = await prisma.staffProfile.create({
    data: {
      organizationId: org.id, userId: barberUser1.id,
      bio: "Master barber with 10 years experience. Specializes in modern fades and textured crops.",
      specialties: ["Fade", "Textured Crop", "Pompadour"],
      tier: "MASTER", status: "AVAILABLE",
      commissionModel: "FLAT_PERCENTAGE", commissionRate: 0.50,
    },
  });

  const staffRudi = await prisma.staffProfile.create({
    data: {
      organizationId: org.id, userId: barberUser2.id,
      bio: "Senior barber specializing in classic cuts and traditional shaves.",
      specialties: ["Classic Cut", "Straight Razor Shave", "Beard Trim"],
      tier: "SENIOR", status: "AVAILABLE",
      commissionModel: "FLAT_PERCENTAGE", commissionRate: 0.45,
    },
  });

  const staffAgus = await prisma.staffProfile.create({
    data: {
      organizationId: org.id, userId: barberUser3.id,
      bio: "Enthusiastic junior barber learning the craft. Great with kids cuts!",
      specialties: ["Kids Cut", "Basic Fade"],
      tier: "JUNIOR", status: "OFF_DUTY",
      commissionModel: "FLAT_PERCENTAGE", commissionRate: 0.40,
    },
  });
  log("+", "3 staff profiles (Master, Senior, Junior)");

  // 2i. Services
  log(">", "Creating services...");
  await prisma.service.deleteMany({ where: { organizationId: org.id } });
  const haircut = await prisma.service.create({
    data: {
      organizationId: org.id, name: "Haircut",
      description: "Classic men's haircut with consultation and styling",
      category: "HAIRCUT", type: "STANDARD", basePrice: 80000,
      durationMinutes: 30, bufferMinutes: 5, sortOrder: 1,
    },
  });

  const shave = await prisma.service.create({
    data: {
      organizationId: org.id, name: "Shave",
      description: "Traditional straight razor shave with hot towel",
      category: "SHAVE", type: "STANDARD", basePrice: 50000,
      durationMinutes: 20, bufferMinutes: 5, sortOrder: 2,
    },
  });

  const hairColoring = await prisma.service.create({
    data: {
      organizationId: org.id, name: "Hair Coloring",
      description: "Full hair coloring with premium products",
      category: "TREATMENT", type: "STANDARD", basePrice: 200000,
      durationMinutes: 60, bufferMinutes: 10, sortOrder: 3,
    },
  });

  await prisma.service.create({
    data: {
      organizationId: org.id, name: "Hot Towel",
      description: "Relaxing hot towel facial treatment",
      category: "TREATMENT", type: "ADD_ON", basePrice: 15000,
      durationMinutes: 5, bufferMinutes: 0, sortOrder: 10,
    },
  });

  await prisma.service.create({
    data: {
      organizationId: org.id, name: "Head Massage",
      description: "5-minute scalp and head massage",
      category: "TREATMENT", type: "ADD_ON", basePrice: 20000,
      durationMinutes: 5, bufferMinutes: 0, sortOrder: 11,
    },
  });

  const combo = await prisma.service.create({
    data: {
      organizationId: org.id, name: "Haircut + Shave Combo",
      description: "Get both haircut and shave at a discounted combo price",
      category: "COMBO", type: "COMBO", basePrice: 120000,
      durationMinutes: 45, bufferMinutes: 5, sortOrder: 5,
    },
  });

  await prisma.comboService.deleteMany({ where: { organizationId: org.id } });
  await prisma.comboService.createMany({
    data: [
      { organizationId: org.id, comboId: combo.id, childServiceId: haircut.id },
      { organizationId: org.id, comboId: combo.id, childServiceId: shave.id },
    ],
  });
  log("+", "6 services (4 standard, 2 add-ons, 1 combo)");

  // 2j. Tier Surcharges
  log(">", "Adding tier surcharges...");
  await prisma.tierSurcharge.deleteMany({ where: { organizationId: org.id } });
  await prisma.tierSurcharge.createMany({
    data: [
      { organizationId: org.id, serviceId: haircut.id, tier: "SENIOR", surcharge: 15000 },
      { organizationId: org.id, serviceId: haircut.id, tier: "MASTER", surcharge: 30000 },
      { organizationId: org.id, serviceId: shave.id, tier: "SENIOR", surcharge: 10000 },
      { organizationId: org.id, serviceId: shave.id, tier: "MASTER", surcharge: 20000 },
      { organizationId: org.id, serviceId: hairColoring.id, tier: "SENIOR", surcharge: 25000 },
      { organizationId: org.id, serviceId: hairColoring.id, tier: "MASTER", surcharge: 50000 },
    ],
  });
  log("+", "6 tier surcharges added");

  // 2k. Branch Service Override
  await prisma.branchServiceOverride.deleteMany({ where: { organizationId: org.id } });
  await prisma.branchServiceOverride.create({
    data: {
      organizationId: org.id,
      branchId: branchSouth.id,
      serviceId: haircut.id,
      overridePrice: 90000,
      isActive: true,
    },
  });
  log("+", "Kemang branch: Haircut overridden to 90K IDR");

  // 2l. Surge Rules
  log(">", "Adding surge pricing rules...");
  await prisma.surgeRule.deleteMany({ where: { organizationId: org.id } });
  await prisma.surgeRule.createMany({
    data: [
      { organizationId: org.id, branchId: branchCentral.id, dayOfWeek: "SATURDAY", startHour: 10, endHour: 14, multiplier: 1.2, isActive: true },
      { organizationId: org.id, branchId: branchCentral.id, dayOfWeek: "SUNDAY", startHour: 10, endHour: 14, multiplier: 1.15, isActive: true },
    ],
  });
  log("+", "2 surge rules at Central branch");

  // 2m. Promo Codes
  log(">", "Creating promo codes...");
  await prisma.promoCode.deleteMany({ where: { organizationId: org.id } });
  await prisma.promoCode.createMany({
    data: [
      {
        organizationId: org.id, code: "WELCOME2026",
        description: "Welcome discount for new customers - 15% off",
        type: "PERCENTAGE", value: 15, minGrossAmount: 50000, maxDiscount: 30000,
        usageLimit: 100, endDate: new Date("2026-12-31T23:59:59Z"),
      },
      {
        organizationId: org.id, code: "DISKON10K",
        description: "Flat 10,000 IDR off any service",
        type: "FIXED", value: 10000, minGrossAmount: 50000,
        usageLimit: 50, endDate: new Date("2026-06-30T23:59:59Z"),
      },
      {
        organizationId: org.id, code: "KEMANGVIP",
        description: "Kemang branch exclusive - 20% off",
        type: "PERCENTAGE", value: 20, minGrossAmount: 80000, maxDiscount: 50000,
        usageLimit: 30, endDate: new Date("2026-12-31T23:59:59Z"),
        branchId: branchSouth.id,
      },
    ],
  });
  log("+", "3 promo codes created");

  // 2n. Products & Inventory
  log(">", "Creating products and inventory...");
  const pomade = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: org.id, sku: "PROD-POMADE-001" } },
    update: {},
    create: { organizationId: org.id, name: "Premium Pomade", sku: "PROD-POMADE-001", description: "Water-based strong hold pomade, 100g", costPrice: 35000, sellPrice: 75000 },
  });
  const shampoo = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: org.id, sku: "PROD-SHAMPOO-001" } },
    update: {},
    create: { organizationId: org.id, name: "Anti-Dandruff Shampoo", sku: "PROD-SHAMPOO-001", description: "Specialized barber shampoo, 250ml", costPrice: 25000, sellPrice: 55000 },
  });
  const aftershave = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: org.id, sku: "PROD-AFTERSHAVE-001" } },
    update: {},
    create: { organizationId: org.id, name: "Aftershave Balm", sku: "PROD-AFTERSHAVE-001", description: "Soothing aftershave balm, 100ml", costPrice: 20000, sellPrice: 45000 },
  });

  await prisma.stockMovement.deleteMany({ where: { organizationId: org.id } });
  await prisma.branchInventory.deleteMany({ where: { organizationId: org.id } });
  await prisma.branchInventory.createMany({
    data: [
      { organizationId: org.id, branchId: branchCentral.id, productId: pomade.id, quantity: 20, reorderThreshold: 5, avgCost: 35000 },
      { organizationId: org.id, branchId: branchCentral.id, productId: shampoo.id, quantity: 15, reorderThreshold: 5, avgCost: 25000 },
      { organizationId: org.id, branchId: branchCentral.id, productId: aftershave.id, quantity: 10, reorderThreshold: 3, avgCost: 20000 },
      { organizationId: org.id, branchId: branchSouth.id, productId: pomade.id, quantity: 12, reorderThreshold: 5, avgCost: 35000 },
      { organizationId: org.id, branchId: branchSouth.id, productId: shampoo.id, quantity: 8, reorderThreshold: 5, avgCost: 25000 },
    ],
  });

  await prisma.stockMovement.createMany({
    data: [
      { organizationId: org.id, productId: pomade.id, branchId: branchCentral.id, type: "IN", quantity: 20, costPerUnit: 35000, note: "Initial stock" },
      { organizationId: org.id, productId: shampoo.id, branchId: branchCentral.id, type: "IN", quantity: 15, costPerUnit: 25000, note: "Initial stock" },
      { organizationId: org.id, productId: aftershave.id, branchId: branchCentral.id, type: "IN", quantity: 10, costPerUnit: 20000, note: "Initial stock" },
      { organizationId: org.id, productId: pomade.id, branchId: branchSouth.id, type: "IN", quantity: 12, costPerUnit: 35000, note: "Initial stock" },
      { organizationId: org.id, productId: shampoo.id, branchId: branchSouth.id, type: "IN", quantity: 8, costPerUnit: 25000, note: "Initial stock" },
    ],
  });
  log("+", "3 products, 5 inventory records, 5 stock movements");

  // 2o. Role-Service Assignments (barbers can perform all services)
  log(">", "Assigning services to barber roles...");
  const allServices = await prisma.service.findMany({ where: { organizationId: org.id } });
  const roleSvcData = [];
  for (const roleName of ["Barber", "Junior Barber"]) {
    const roleId = roles[roleName];
    for (const svc of allServices) {
      roleSvcData.push({ organizationId: org.id, tenantRoleId: roleId, serviceId: svc.id });
    }
  }
  await prisma.tenantRoleService.deleteMany({ where: { organizationId: org.id } });
  await prisma.tenantRoleService.createMany({ data: roleSvcData });
  log("+", `${roleSvcData.length} role-service assignments`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("  Seeding complete!");
  console.log("=".repeat(60));
  console.log(`
  Data Summary:
  -------------------------------------------
  PLATFORM LEVEL
    Features           ${FEATURES.length}
    Industry Templates ${TEMPLATES.length}
    Platform Admin     1 (admin@tmng.dev)

  TENANT: ${org.name} (${org.slug})
    Tenant Roles       ${ROLES_DEF.length} (Owner, Manager, Barber, Jr Barber, Cashier, Customer)
    Permission Entries ${permData.length}
    Branches           2 (Central Jakarta, Kemang)
    Operating Hours    14
    Users              8 (1 Owner, 1 Manager, 1 Cashier, 3 Barbers, 2 Customers)
    Staff Profiles     3 (Master, Senior, Junior)
    Services           6 (3 Standard, 2 Add-Ons, 1 Combo)
    Tier Surcharges    6
    Promo Codes        3
    Products           3
    Inventory          5

  Login Credentials (all passwords: Password123!)
  -------------------------------------------
  Owner       : owner@barber.com
  Manager     : manager@barber.com
  Cashier     : cashier@barber.com
  Barber 1    : budi@barber.com       (Master)
  Barber 2    : rudi@barber.com       (Senior)
  Barber 3    : agus@barber.com       (Junior)
  Customer 1  : customer1@gmail.com
  Customer 2  : customer2@gmail.com

  Platform Admin: admin@tmng.dev / PlatformAdmin123!
  `);
}

main()
  .catch((e) => {
    console.error("\nSeed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
