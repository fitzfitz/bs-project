import { describe, it, expect, vi, beforeEach } from "vitest";
import crmApp from "./crm.index";
import { listCustomersQuery, recomputeSegmentsSchema } from "./crm.schema";
import { CrmService } from "./crm.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("crm schema", () => {
  it("listCustomersQuery requires branchId", () => {
    expect(listCustomersQuery.safeParse({}).success).toBe(false);
    expect(listCustomersQuery.safeParse({ branchId: "b1" }).success).toBe(true);
  });

  it("recomputeSegmentsSchema requires branchId", () => {
    expect(recomputeSegmentsSchema.safeParse({}).success).toBe(false);
    expect(recomputeSegmentsSchema.safeParse({ branchId: "b1" }).success).toBe(true);
  });
});

describe("CrmService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("getCustomerInsights aggregates completed transactions", async () => {
    const created = new Date();
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        netAmount: 100_000,
        createdAt: created,
        items: [{ name: "Cut" }, { name: "Cut" }, { name: "Wash" }],
      },
    ]);
    (db.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      tier: "GOLD",
    });
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
    });
    (db.customerSegmentMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const insight = await CrmService.getCustomerInsights(db, "b1", "c1");
    expect(insight.totalVisits).toBe(1);
    expect(insight.totalSpend).toBe(100_000);
    expect(insight.favoriteServices[0]).toBe("Cut");
    expect(insight.loyaltyTier).toBe("GOLD");
  });

  it("listSegments maps member counts", async () => {
    (db.customerSegment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", name: "VIP", isAutomatic: true, _count: { members: 3 } },
    ]);
    const rows = await CrmService.listSegments(db, "b1");
    expect(rows[0].memberCount).toBe(3);
  });

  it("recomputeSegments upserts auto segments", async () => {
    (db.customerSegment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.customerSegment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const r = await CrmService.recomputeSegments(db, "b1", "org-1");
    expect(r.segmentsProcessed).toBe(0);
    expect(db.customerSegment.upsert).toHaveBeenCalled();
  });
});

describe("crm HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "CRM", canRead: true }]);
  });

  it("GET /customers returns 401 without token", async () => {
    const app = mountFeatureWithDb(crmApp, db);
    const res = await app.request("http://t/customers?branchId=b1", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  it("GET /customers returns 403 without CRM read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(crmApp, db);
    const res = await app.request("http://t/customers?branchId=b1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(403);
  });

  it("GET /customers returns 200 when permitted", async () => {
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(crmApp, db);
    const res = await app.request("http://t/customers?branchId=b1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
  });

  it("GET /customers returns 400 when branchId query param is missing", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(crmApp, db);
    const res = await app.request("http://t/customers", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(400);
  });

  it("GET /customers returns 200 with customer data when branch has completed transactions", async () => {
    const lastVisit = new Date("2025-03-01T10:00:00.000Z");
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        customerId: "cust-1",
        _count: 2,
        _sum: { netAmount: 150_000 },
        _max: { createdAt: lastVisit },
      },
    ]);
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        netAmount: 80_000,
        createdAt: lastVisit,
        items: [{ name: "Cut" }],
      },
      {
        netAmount: 70_000,
        createdAt: new Date("2025-02-01T10:00:00.000Z"),
        items: [{ name: "Cut" }, { name: "Wash" }],
      },
    ]);
    (db.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: "SILVER" });
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@example.com",
    });
    (db.customerSegmentMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(crmApp, db);
    const res = await app.request("http://t/customers?branchId=b1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ customerId: string; totalVisits: number; totalSpend: number }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].customerId).toBe("cust-1");
    expect(body.data[0].totalVisits).toBe(2);
    expect(body.data[0].totalSpend).toBe(150_000);
  });

  it("POST /segments/recompute returns 200 when permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "CRM", canRead: true }]);
    (db.customerSegment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.customerSegment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(crmApp, db);
    const res = await app.request("http://t/segments/recompute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branchId: "b1" }),
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { segmentsProcessed: number } };
    expect(body.data.segmentsProcessed).toBe(0);
  });
});
