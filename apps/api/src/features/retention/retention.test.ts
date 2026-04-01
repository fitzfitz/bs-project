import { describe, it, expect, vi, beforeEach } from "vitest";
import retentionApp from "./retention.index";
import { RetentionService } from "./retention.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("RetentionService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("getStats aggregates audit rows", async () => {
    (db.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValueOnce(100).mockResolvedValueOnce(12);
    const s = await RetentionService.getStats(db);
    expect(s.totalNudges).toBe(100);
    expect(s.last30Days).toBe(12);
  });

  it("processRetentionTriggers sends at-risk nudge when allowed", async () => {
    const customerId = "cust-at-risk";
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { customerId, _max: { createdAt: new Date(Date.now() - 45 * 86400_000) } },
    ]);
    (db.customerMembership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.auditLog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ organizationId: "org-1" });
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const sendPush = vi.fn().mockResolvedValue(true);
    const ns = { sendPush, sendSms: vi.fn() };
    const result = await RetentionService.processRetentionTriggers(db, ns as never);
    expect(result.atRiskSent).toBeGreaterThanOrEqual(1);
    expect(sendPush).toHaveBeenCalled();
  });

  it("processRetentionTriggers sends expiry warning for soon-expiring points", async () => {
    (db.transaction.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const soon = new Date(Date.now() + 3 * 86400_000);
    (db.customerMembership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "u-exp", organizationId: "org-1", pointsBalance: 50, pointsExpiringAt: soon },
    ]);
    (db.auditLog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const sendPush = vi.fn().mockResolvedValue(true);
    const result = await RetentionService.processRetentionTriggers(db, { sendPush, sendSms: vi.fn() } as never);
    expect(result.expirySent).toBeGreaterThanOrEqual(1);
    expect(sendPush).toHaveBeenCalled();
  });
});

describe("retention HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "RETENTION", canRead: true }]);
  });

  it("POST /trigger returns 401 without token", async () => {
    const app = mountFeatureWithDb(retentionApp, db);
    const res = await app.request("http://t/trigger", { method: "POST" }, env);
    expect(res.status).toBe(401);
  });

  it("GET /stats returns 403 without RETENTION read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(retentionApp, db);
    const res = await app.request("http://t/stats", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(403);
  });

  it("GET /stats returns 200 when permitted", async () => {
    (db.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(retentionApp, db);
    const res = await app.request("http://t/stats", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { totalNudges: number } };
    expect(body.success).toBe(true);
    expect(body.data.totalNudges).toBe(5);
  });

  it("POST /trigger returns 200 with atRiskSent and expirySent from service", async () => {
    const spy = vi
      .spyOn(RetentionService, "processRetentionTriggers")
      .mockResolvedValue({ atRiskSent: 3, expirySent: 7 });
    try {
      const token = await signTestJwt({
        sub: testUsers.branchManager.userId,
        organizationId: testUsers.branchManager.organizationId,
        tenantRoleId: testUsers.branchManager.tenantRoleId,
        branchId: testUsers.branchManager.branchId,
        scope: testUsers.branchManager.scope,
      });
      const app = mountFeatureWithDb(retentionApp, db);
      const res = await app.request(
        "http://t/trigger",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { atRiskSent: number; expirySent: number };
      };
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ atRiskSent: 3, expirySent: 7 });
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /stats response includes totalNudges and last30Days", async () => {
    (db.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValueOnce(42).mockResolvedValueOnce(9);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(retentionApp, db);
    const res = await app.request(
      "http://t/stats",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { totalNudges: number; last30Days: number };
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ totalNudges: 42, last30Days: 9 });
  });

  it("rejects unsupported methods on defined routes (no handler for GET /trigger)", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(retentionApp, db);
    const res = await app.request(
      "http://t/trigger",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("POST /stats is not registered (only GET is supported)", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(retentionApp, db);
    const res = await app.request(
      "http://t/stats",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});
