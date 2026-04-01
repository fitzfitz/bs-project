import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateCommissionSchema,
  listEarningsQuerySchema,
} from "./commissions.schema";
import { CommissionService } from "./commissions.service";
import commissionsApp from "./commissions.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("commissions.schema", () => {
  it("calculateCommission requires YYYY-MM-DD date", () => {
    expect(
      calculateCommissionSchema.safeParse({ staffProfileId: "s1", date: "01-01-2025" }).success,
    ).toBe(false);
    expect(
      calculateCommissionSchema.safeParse({ staffProfileId: "s1", date: "2025-01-01" }).success,
    ).toBe(true);
  });

  it("listEarningsQuery defaults pagination", () => {
    const q = listEarningsQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
  });
});

describe("CommissionService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("calculateDaily throws when staff missing", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      CommissionService.calculateDaily(db, "missing", new Date("2025-01-01")),
    ).rejects.toThrow("Staff not found");
  });

  it("calculateDaily upserts earning for FLAT_PERCENTAGE", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "FLAT_PERCENTAGE",
      commissionRate: 0.1,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 100, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "e1",
      staffProfileId: "sp1",
      date: new Date("2025-01-01"),
      commissionBase: 100,
      commission: 10,
      tips: 0,
      total: 10,
      createdAt: new Date(),
    });
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commissionBase).toBe(100);
    expect(earning.commission).toBe(10);
  });

  it("SLIDING_SCALE: single tier covers all revenue", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "SLIDING_SCALE",
      commissionRate: null,
      commissionTiers: [{ minRevenue: 0, maxRevenue: null, rate: 0.05 }],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 200, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commissionBase).toBe(200);
    expect(earning.commission).toBe(10);
    expect(earning.total).toBe(10);
  });

  it("SLIDING_SCALE: multi-tier brackets (e.g. 0-100 at 5%, 100-500 at 10%, 500+ at 15%)", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "SLIDING_SCALE",
      commissionRate: null,
      commissionTiers: [
        { minRevenue: 0, maxRevenue: 100, rate: 0.05 },
        { minRevenue: 100, maxRevenue: 500, rate: 0.1 },
        { minRevenue: 500, maxRevenue: null, rate: 0.15 },
      ],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 600, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commissionBase).toBe(600);
    expect(earning.commission).toBe(60);
  });

  it("SLIDING_SCALE: empty tiers → commission = 0", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "SLIDING_SCALE",
      commissionRate: null,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 100, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commission).toBe(0);
    expect(earning.total).toBe(earning.tips);
  });

  it("BASE_PLUS_BONUS: prorated base salary + bonus rate", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "BASE_PLUS_BONUS",
      commissionRate: null,
      commissionTiers: [],
      baseSalary: 2700,
      bonusRate: 0.1,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 200, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date(2025, 0, 15));
    expect(earning.commissionBase).toBe(200);
    expect(earning.commission).toBe(120);
  });

  it("BASE_PLUS_BONUS: null baseSalary and bonusRate → commission = 0", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "BASE_PLUS_BONUS",
      commissionRate: null,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 200, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date(2025, 0, 15));
    expect(earning.commission).toBe(0);
  });

  it("Default commission model: falls back to flat percentage", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "UNKNOWN_MODEL",
      commissionRate: 0.2,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    } as never);
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [{ serviceId: "srv", unitPrice: 50, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commission).toBe(10);
  });

  it("Tips PER_STAFF: sum tipAmount from staff's transactions", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "FLAT_PERCENTAGE",
      commissionRate: 0.1,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 5,
        items: [{ serviceId: "a", unitPrice: 10, quantity: 1, discount: 0 }],
      },
      {
        branchId: "b1",
        tipAmount: 7,
        items: [{ serviceId: "b", unitPrice: 10, quantity: 1, discount: 0 }],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commissionBase).toBe(20);
    expect(earning.tips).toBe(12);
    expect(earning.total).toBe(2 + 12);
  });

  it("Tips POOLED: evenly split among distinct staff", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "FLAT_PERCENTAGE",
      commissionRate: 0,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    const staffTxs = [
      {
        branchId: "b1",
        tipAmount: 30,
        items: [{ serviceId: "srv", unitPrice: 100, quantity: 1, discount: 0 }],
      },
    ];
    const allBranchTxs = [
      { tipAmount: 30, staffProfileId: "sp1" },
      { tipAmount: 10, staffProfileId: "sp2" },
    ];
    (db.transaction.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(staffTxs)
      .mockResolvedValueOnce(allBranchTxs);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "POOLED" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.tips).toBe(20);
  });

  it("Commission base excludes non-service items (productId-only items)", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "FLAT_PERCENTAGE",
      commissionRate: 0.1,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        branchId: "b1",
        tipAmount: 0,
        items: [
          { serviceId: null, productId: "p1", unitPrice: 999, quantity: 2, discount: 0 },
          { serviceId: "srv", unitPrice: 50, quantity: 1, discount: 5 },
        ],
      },
    ]);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-01-01"));
    expect(earning.commissionBase).toBe(45);
    expect(earning.commission).toBe(4.5);
  });

  it("No transactions: base/tips 0, upserts zeros (FLAT)", async () => {
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sp1",
      organizationId: "org-1",
      commissionModel: "FLAT_PERCENTAGE",
      commissionRate: 0.15,
      commissionTiers: [],
      baseSalary: null,
      bonusRate: null,
    });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.staffEarning.upsert as ReturnType<typeof vi.fn>).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "e1",
      ...args.create,
      createdAt: new Date(),
    }));
    const earning = await CommissionService.calculateDaily(db, "sp1", new Date("2025-06-10"));
    expect(earning.commissionBase).toBe(0);
    expect(earning.tips).toBe(0);
    expect(earning.commission).toBe(0);
    expect(earning.total).toBe(0);
  });

  it("triggerOnPaid: non-POOLED calculates for tx staff only", async () => {
    const spy = vi.spyOn(CommissionService, "calculateDaily").mockResolvedValue({ id: "e1" } as never);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      staffProfileId: "sp-only",
      branchId: "b1",
      createdAt: new Date(Date.UTC(2025, 2, 10, 14, 0, 0)),
    });
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    await CommissionService.triggerOnPaid(db, "tx-1");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(db, "sp-only", expect.any(Date));
    spy.mockRestore();
  });

  it("triggerOnPaid: POOLED recalculates for all staff at branch", async () => {
    const spy = vi.spyOn(CommissionService, "calculateDaily").mockResolvedValue({ id: "e1" } as never);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      staffProfileId: "sp1",
      branchId: "b-pool",
      createdAt: new Date(Date.UTC(2025, 2, 10, 9, 0, 0)),
    });
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "POOLED" });
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { staffProfileId: "sp1" },
      { staffProfileId: "sp2" },
    ]);
    await CommissionService.triggerOnPaid(db, "tx-pooled");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(db, "sp1", expect.any(Date));
    expect(spy).toHaveBeenCalledWith(db, "sp2", expect.any(Date));
    spy.mockRestore();
  });

  it("triggerOnPaid: missing branchId returns null", async () => {
    const spy = vi.spyOn(CommissionService, "calculateDaily");
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      staffProfileId: "sp1",
      branchId: null,
      createdAt: new Date(),
    });
    const out = await CommissionService.triggerOnPaid(db, "tx-no-branch");
    expect(out).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("triggerOnPaid: non-POOLED with no staffProfileId returns null", async () => {
    const spy = vi.spyOn(CommissionService, "calculateDaily");
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      staffProfileId: null,
      branchId: "b1",
      createdAt: new Date(),
    });
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipDistribution: "PER_STAFF" });
    const out = await CommissionService.triggerOnPaid(db, "tx-no-staff");
    expect(out).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("triggerOnPaid: tx not found returns null", async () => {
    const spy = vi.spyOn(CommissionService, "calculateDaily");
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const out = await CommissionService.triggerOnPaid(db, "missing-tx");
    expect(out).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("recalculateDay: deletes then recalculates", async () => {
    const spy = vi.spyOn(CommissionService, "calculateDaily").mockResolvedValue({ id: "recomputed" } as never);
    await CommissionService.recalculateDay(db, "sp1", new Date(2025, 4, 5));
    expect(db.staffEarning.deleteMany).toHaveBeenCalledWith({
      where: { staffProfileId: "sp1", date: new Date(2025, 4, 5) },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(db, "sp1", new Date(2025, 4, 5));
    spy.mockRestore();
  });

  it("getEarnings: pagination and date range", async () => {
    const findMany = db.staffEarning.findMany as ReturnType<typeof vi.fn>;
    const countFn = db.staffEarning.count as ReturnType<typeof vi.fn>;
    findMany.mockResolvedValue([]);
    countFn.mockResolvedValue(47);
    const query = listEarningsQuerySchema.parse({
      page: 2,
      limit: 10,
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      staffProfileId: "sp1",
    });
    const result = await CommissionService.getEarnings(db, query);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          staffProfileId: "sp1",
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      }),
    );
    expect(result.total).toBe(47);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(5);
  });

  it("getEarningsForBarber: delegates with staffProfileId", async () => {
    const spy = vi.spyOn(CommissionService, "getEarnings").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    const query = listEarningsQuerySchema.parse({ page: 1, limit: 20 });
    await CommissionService.getEarningsForBarber(db, "barber-sp", query);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ staffProfileId: "barber-sp", page: 1, limit: 20 }),
    );
    spy.mockRestore();
  });
});

describe("commissions HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "COMMISSION", canRead: true, canCreate: true, canUpdate: true },
    ]);
  });

  it("returns 403 for GET /me when user is customer (requireStaff)", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(commissionsApp, db);
    const res = await app.request("http://t/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 for GET /me when user has no staffProfile", async () => {
    const token = await signTestJwt({
      sub: testUsers.barber.userId,
      organizationId: testUsers.barber.organizationId,
      tenantRoleId: testUsers.barber.tenantRoleId,
      branchId: testUsers.barber.branchId,
      scope: testUsers.barber.scope,
    });
    (db.staffProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(commissionsApp, db);
    const res = await app.request("http://t/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toContain("not staff");
  });

  it("returns 401 without token for calculate", async () => {
    const app = mountFeatureWithDb(commissionsApp, db);
    const res = await app.request("http://t/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffProfileId: "s1", date: "2025-01-01" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 without COMMISSION create", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "COMMISSION", canRead: true }]);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(commissionsApp, db);
    const res = await app.request("http://t/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffProfileId: "s1", date: "2025-01-01" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when calculate staff not found", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(commissionsApp, db);
    const res = await app.request("http://t/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffProfileId: "nope", date: "2025-01-01" }),
    });
    expect(res.status).toBe(404);
  });
});
