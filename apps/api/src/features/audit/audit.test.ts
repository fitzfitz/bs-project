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
import { auditLogQuery, anomalyQuery, resolveAnomalySchema } from "./audit.schema";
import { AuditService } from "./audit.service";
import auditApp from "./audit.index";

describe("audit.schema", () => {
  it("parses auditLogQuery with defaults", () => {
    const q = auditLogQuery.parse({});
    expect(q.page).toBe("1");
    expect(q.limit).toBe("50");
  });

  it("parses anomalyQuery", () => {
    const q = anomalyQuery.parse({ isResolved: "true" });
    expect(q.isResolved).toBe("true");
  });

  it("parses resolveAnomalySchema", () => {
    expect(resolveAnomalySchema.safeParse({}).success).toBe(true);
    expect(resolveAnomalySchema.parse({ notes: "ok" }).notes).toBe("ok");
  });
});

describe("AuditService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("listLogs applies BRANCH scope filter when branchId omitted", async () => {
    (db.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await AuditService.listLogs(db, {
      page: 1,
      limit: 10,
      callerScope: "BRANCH",
      callerBranchId: "branch-1",
    });

    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: "branch-1" }),
      }),
    );
  });

  it("listAnomalies respects type filter", async () => {
    (db.anomalyFlag.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.anomalyFlag.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await AuditService.listAnomalies(db, {
      type: "HIGH_DISCOUNT",
      page: 1,
      limit: 10,
      callerScope: "HQ",
    });

    expect(db.anomalyFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "HIGH_DISCOUNT" }),
      }),
    );
  });

  it("resolveAnomaly throws when not found", async () => {
    (db.anomalyFlag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(AuditService.resolveAnomaly(db, "missing", "admin-1")).rejects.toThrow(
      "Anomaly not found",
    );
  });

  it("resolveAnomaly throws when already resolved", async () => {
    (db.anomalyFlag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      isResolved: true,
      details: {},
    });
    await expect(AuditService.resolveAnomaly(db, "a1", "admin-1")).rejects.toThrow(
      "already resolved",
    );
  });

  it("resolveAnomaly updates when valid", async () => {
    (db.anomalyFlag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      isResolved: false,
      details: { foo: 1 },
    });
    (db.anomalyFlag.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      isResolved: true,
    });

    const out = await AuditService.resolveAnomaly(db, "a1", "admin-1", "fixed");
    expect(out.isResolved).toBe(true);
    expect(db.anomalyFlag.update).toHaveBeenCalled();
  });

  it("getAnomalyStats aggregates", async () => {
    (db.anomalyFlag.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);
    (db.anomalyFlag.groupBy as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ severity: "HIGH", _count: 2 }])
      .mockResolvedValueOnce([{ type: "X", _count: 1 }]);

    const stats = await AuditService.getAnomalyStats(db, "b1");
    expect(stats.total).toBe(10);
    expect(stats.unresolved).toBe(3);
    expect(stats.bySeverity[0].count).toBe(2);
  });
});

describe("audit HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = withPrismaScopeChain(createMockDb());
    app = mountFeatureWithDb(auditApp, db);
    vi.clearAllMocks();
  });

  it("returns 401 without token on /logs", async () => {
    const res = await app.request("/logs", {}, getTestBindings());
    expect(res.status).toBe(401);
  });

  it("returns 403 without AUDIT_LOG read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-audit-deny",
      scope: "HQ",
    });
    const res = await app.request(
      "/logs",
      { headers: { Authorization: `Bearer ${token}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 for /logs when permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "AUDIT_LOG", canRead: true }]);
    (db.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-audit-ok",
      scope: "HQ",
    });
    const res = await app.request(
      "/logs",
      { headers: { Authorization: `Bearer ${token}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when resolving missing anomaly", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "AUDIT_LOG", canRead: true }]);
    (db.anomalyFlag.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-audit-resolve",
      scope: "HQ",
    });
    const res = await app.request(
      "/anomalies/bad-id/resolve",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(404);
  });
});
