import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockDb,
  mountFeatureWithDb,
  withPrismaScopeChain,
  signTestJwt,
  mockTenantRolePermissions,
  getTestBindings,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";
import { generateReportQuery, exportCsvQuery, exportPdfQuery } from "./reports.schema";
import { ReportsService } from "./reports.service";
import reportsApp from "./reports.index";

describe("reports.schema", () => {
  it("rejects invalid report type", () => {
    expect(
      generateReportQuery.safeParse({
        type: "invalid",
        branchId: "b1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }).success,
    ).toBe(false);
  });

  it("accepts daily_revenue", () => {
    const q = generateReportQuery.parse({
      type: "daily_revenue",
      branchId: "b1",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });
    expect(q.type).toBe("daily_revenue");
  });

  it("exportCsvQuery matches generate enums", () => {
    const a = generateReportQuery.safeParse({
      type: "booking_source",
      branchId: "b1",
      dateFrom: "a",
      dateTo: "b",
    }).success;
    const b = exportCsvQuery.safeParse({
      type: "booking_source",
      branchId: "b1",
      dateFrom: "a",
      dateTo: "b",
    }).success;
    expect(a && b).toBe(true);
  });

  it("exportPdfQuery matches generate enums", () => {
    const a = exportPdfQuery.safeParse({
      type: "daily_revenue",
      branchId: "b1",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    }).success;
    expect(a).toBe(true);
  });
});

describe("ReportsService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("dailyRevenueReport maps snapshots to rows", async () => {
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        date: new Date("2025-01-01T00:00:00.000Z"),
        totalRevenue: 100,
        serviceRevenue: 80,
        productRevenue: 20,
        totalTips: 5,
        transactionCount: 3,
        avgTransValue: 33.33,
      },
    ]);

    const report = await ReportsService.generateReport(db, {
      type: "daily_revenue",
      branchId: "b1",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });

    expect(report.type).toBe("daily_revenue");
    expect(report.rows).toHaveLength(1);
    expect(report.columns).toContain("Revenue");
  });

  it("throws on unknown type", async () => {
    await expect(
      ReportsService.generateReport(db, {
        type: "unknown_type",
        branchId: "b1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      } as { type: string; branchId: string; dateFrom: string; dateTo: string }),
    ).rejects.toThrow("Unknown report type");
  });

  it("exportCSV escapes commas in strings", () => {
    const csv = ReportsService.exportCSV({
      type: "t",
      columns: ["A", "B"],
      rows: [{ A: "x,y", B: 1 }],
      generatedAt: "t",
    });
    expect(csv).toContain('"x,y"');
  });

  it("exportPDF returns a PDF buffer with header", async () => {
    const buf = await ReportsService.exportPDF(
      {
        type: "daily_revenue",
        columns: ["A"],
        rows: [{ A: 1 }],
        generatedAt: "t",
      },
      { dateFrom: "2025-01-01", dateTo: "2025-01-31" },
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("computeNextRunAt DAILY yields 06:00 UTC after reference time", () => {
    const from = new Date("2026-03-24T10:00:00.000Z");
    const next = ReportsService.computeNextRunAt("DAILY", from);
    expect(next.getUTCHours()).toBe(6);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("reports HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = withPrismaScopeChain(createMockDb());
    app = mountFeatureWithDb(reportsApp, db);
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const res = await app.request(
      "/generate?type=daily_revenue&branchId=b1&dateFrom=2025-01-01&dateTo=2025-01-31",
      {},
      getTestBindings(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without REPORTS read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-rep-deny",
      scope: "HQ",
    });
    const res = await app.request(
      "/generate?type=daily_revenue&branchId=b1&dateFrom=2025-01-01&dateTo=2025-01-31",
      { headers: { Authorization: `Bearer ${token}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 JSON when permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "REPORTS", canRead: true }]);
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-rep-ok",
      scope: "HQ",
    });
    const res = await app.request(
      "/generate?type=daily_revenue&branchId=b1&dateFrom=2025-01-01&dateTo=2025-01-31",
      { headers: { Authorization: `Bearer ${token}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  const readPerms = [{ featureCode: "REPORTS", canRead: true }];
  const fullPerms = [
    {
      featureCode: "REPORTS",
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    },
  ];

  const authHeaders = async (roleId: string) => ({
    Authorization: `Bearer ${await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: roleId,
      scope: "HQ",
    })}`,
  });

  it("GET /export/pdf returns 200 and application/pdf when permitted", async () => {
    mockTenantRolePermissions(db, readPerms);
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await app.request(
      "/export/pdf?type=daily_revenue&branchId=b1&dateFrom=2025-01-01&dateTo=2025-01-31",
      { headers: await authHeaders("role-rep-pdf") },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")?.includes("application/pdf")).toBe(true);
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(...buf.subarray(0, 4))).toBe("%PDF");
  });

  it("GET /schedules returns 401 without auth", async () => {
    const res = await app.request("/schedules", {}, getTestBindings());
    expect(res.status).toBe(401);
  });

  it("GET /schedules returns 403 without REPORTS read", async () => {
    mockTenantRolePermissions(db, []);
    const res = await app.request("/schedules", { headers: await authHeaders("role-sch-deny") }, getTestBindings());
    expect(res.status).toBe(403);
  });

  it("GET /schedules returns 200 when permitted", async () => {
    mockTenantRolePermissions(db, readPerms);
    (db.reportSchedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await app.request("/schedules", { headers: await authHeaders("role-sch-read") }, getTestBindings());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("POST /schedules returns 403 without REPORTS create", async () => {
    mockTenantRolePermissions(db, readPerms);
    const res = await app.request(
      "/schedules",
      {
        method: "POST",
        headers: { ...(await authHeaders("role-sch-no-create")), "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "daily_revenue",
          branchId: "b1",
          frequency: "DAILY",
          recipients: ["x@y.com"],
        }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("POST /schedules returns 201 when permitted", async () => {
    mockTenantRolePermissions(db, fullPerms);
    const nextRun = new Date("2026-04-01T06:00:00.000Z");
    (db.reportSchedule.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sch-1",
      organizationId: "org-1",
      branchId: "b1",
      reportType: "daily_revenue",
      frequency: "DAILY",
      recipients: ["x@y.com"],
      filters: {},
      isActive: true,
      lastSentAt: null,
      nextRunAt: nextRun,
      createdBy: "u1",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });

    const res = await app.request(
      "/schedules",
      {
        method: "POST",
        headers: { ...(await authHeaders("role-sch-create")), "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "daily_revenue",
          branchId: "b1",
          frequency: "DAILY",
          recipients: ["x@y.com"],
        }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("sch-1");
  });

  it("PATCH /schedules/:id returns 404 when not found", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "REPORTS", canUpdate: true }]);
    (db.reportSchedule.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request(
      "/schedules/missing",
      {
        method: "PATCH",
        headers: { ...(await authHeaders("role-sch-patch")), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /schedules/:id returns 403 without REPORTS update", async () => {
    mockTenantRolePermissions(db, readPerms);
    const res = await app.request(
      "/schedules/sch-1",
      {
        method: "PATCH",
        headers: { ...(await authHeaders("role-sch-no-patch")), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("PATCH /schedules/:id returns 200 when permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "REPORTS", canUpdate: true }]);
    const nextRun = new Date("2026-04-01T06:00:00.000Z");
    (db.reportSchedule.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sch-1",
      organizationId: "org-1",
      branchId: "b1",
      reportType: "daily_revenue",
      frequency: "DAILY",
      recipients: ["x@y.com"],
      filters: {},
      isActive: true,
      lastSentAt: null,
      nextRunAt: nextRun,
      createdBy: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (db.reportSchedule.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sch-1",
      organizationId: "org-1",
      branchId: "b1",
      reportType: "daily_revenue",
      frequency: "WEEKLY",
      recipients: ["x@y.com"],
      filters: {},
      isActive: false,
      lastSentAt: null,
      nextRunAt: new Date("2026-03-31T06:00:00.000Z"),
      createdBy: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.request(
      "/schedules/sch-1",
      {
        method: "PATCH",
        headers: { ...(await authHeaders("role-sch-patch-ok")), "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: "WEEKLY", isActive: false }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { isActive: boolean } };
    expect(body.data.isActive).toBe(false);
  });

  it("DELETE /schedules/:id returns 403 without REPORTS delete", async () => {
    mockTenantRolePermissions(db, readPerms);
    const res = await app.request(
      "/schedules/sch-1",
      { method: "DELETE", headers: await authHeaders("role-sch-no-del") },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("DELETE /schedules/:id returns 200 when permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "REPORTS", canDelete: true }]);
    (db.reportSchedule.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const res = await app.request(
      "/schedules/sch-1",
      { method: "DELETE", headers: await authHeaders("role-sch-del") },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
  });

  it("GET /templates returns 200 when permitted", async () => {
    mockTenantRolePermissions(db, readPerms);
    (db.savedReportTemplate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await app.request("/templates", { headers: await authHeaders("role-tpl-read") }, getTestBindings());
    expect(res.status).toBe(200);
  });

  it("POST /templates returns 201 when permitted", async () => {
    mockTenantRolePermissions(db, fullPerms);
    (db.savedReportTemplate.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tpl-1",
      organizationId: "org-1",
      name: "My template",
      reportType: "daily_revenue",
      filters: {},
      createdBy: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.request(
      "/templates",
      {
        method: "POST",
        headers: { ...(await authHeaders("role-tpl-create")), "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My template", reportType: "daily_revenue" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(201);
  });

  it("DELETE /templates/:id returns 403 without REPORTS delete", async () => {
    mockTenantRolePermissions(db, readPerms);
    const res = await app.request(
      "/templates/tpl-1",
      { method: "DELETE", headers: await authHeaders("role-tpl-no-del") },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("DELETE /templates/:id returns 200 when permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "REPORTS", canDelete: true }]);
    (db.savedReportTemplate.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const res = await app.request(
      "/templates/tpl-1",
      { method: "DELETE", headers: await authHeaders("role-tpl-del") },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
  });
});
