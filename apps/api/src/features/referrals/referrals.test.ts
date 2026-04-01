import { describe, it, expect, vi, beforeEach } from "vitest";
import referralsApp from "./referrals.index";
import { applyReferralSchema, referralHistoryQuery } from "./referrals.schema";
import { ReferralService } from "./referrals.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("referrals schema", () => {
  it("applyReferralSchema requires non-empty code", () => {
    expect(applyReferralSchema.safeParse({ referralCode: "" }).success).toBe(false);
    expect(applyReferralSchema.safeParse({ referralCode: "ABC" }).success).toBe(true);
  });

  it("referralHistoryQuery coerces pagination", () => {
    const q = referralHistoryQuery.parse({ page: "3", limit: "10" });
    expect(q.page).toBe(3);
    expect(q.limit).toBe(10);
  });
});

describe("ReferralService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("applyReferralCode throws on invalid code", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ organizationId: "org-1" });
    (db.customerMembership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(ReferralService.applyReferralCode(db, "u-new", "NOPE")).rejects.toThrow(
      /Invalid referral code/,
    );
  });

  it("applyReferralCode rejects self-referral", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ organizationId: "org-1" });
    (db.customerMembership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u-same",
    });
    await expect(ReferralService.applyReferralCode(db, "u-same", "CODE")).rejects.toThrow(
      /Cannot refer yourself/,
    );
  });

  it("applyReferralCode rejects duplicate pair", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ organizationId: "org-1" });
    (db.customerMembership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "ref-1",
    });
    (db.referral.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });
    await expect(ReferralService.applyReferralCode(db, "u-new", "CODE")).rejects.toThrow(
      /Referral already applied/,
    );
  });

  it("getReferralStats returns conversion rate", async () => {
    (db.referral.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(6);
    const s = await ReferralService.getReferralStats(db);
    expect(s.total).toBe(10);
    expect(s.completed).toBe(4);
    expect(s.pending).toBe(6);
    expect(s.conversionRate).toBe(0.4);
  });

  it("getReferralHistory paginates", async () => {
    (db.referral.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.referral.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const r = await ReferralService.getReferralHistory(db, "u1", 2, 5);
    expect(r.page).toBe(2);
    expect(r.limit).toBe(5);
    expect(db.referral.findMany).toHaveBeenCalled();
  });
});

describe("referrals HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "REFERRALS", canRead: true }]);
  });

  it("GET /me/code returns 401 without token", async () => {
    const app = mountFeatureWithDb(referralsApp, db);
    const res = await app.request("http://t/me/code", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  it("GET /me/code returns 200 with code when flow succeeds", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: "org-1",
      firstName: "Ann",
    });
    (db.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      referralCode: "ANN1234",
    });
    const app = mountFeatureWithDb(referralsApp, db);
    const res = await app.request("http://t/me/code", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { referralCode: string } };
    expect(body.success).toBe(true);
    expect(body.data.referralCode).toBe("ANN1234");
  });

  it("GET /stats returns 403 without REFERRALS read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(referralsApp, db);
    const res = await app.request("http://t/stats", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(403);
  });
});
