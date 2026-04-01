import { describe, it, expect, vi, beforeEach } from "vitest";
import loyaltyApp from "./loyalty.index";
import {
  redeemPointsSchema,
  adjustPointsSchema,
  loyaltyHistoryQuery,
} from "./loyalty.schema";
import { LoyaltyService } from "./loyalty.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

function buildTx() {
  const state = {
    membership: {
      id: "mem-1",
      userId: "cust-1",
      organizationId: "org-1",
      pointsBalance: 100,
      lifetimePoints: 200,
      tier: "BRONZE" as const,
      tierMultiplier: 1,
    },
  };
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
    },
    customerMembership: {
      upsert: vi.fn().mockImplementation(async () => state.membership),
      findUnique: vi.fn().mockImplementation(async () => ({ ...state.membership })),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        if (
          data.pointsBalance &&
          typeof data.pointsBalance === "object" &&
          "increment" in data.pointsBalance
        ) {
          state.membership.pointsBalance += (data.pointsBalance as { increment: number }).increment;
          state.membership.lifetimePoints += (data.pointsBalance as { increment: number }).increment;
        }
        if (
          data.pointsBalance &&
          typeof data.pointsBalance === "object" &&
          "decrement" in data.pointsBalance
        ) {
          state.membership.pointsBalance -= (data.pointsBalance as { decrement: number }).decrement;
        }
        return { ...state.membership };
      }),
    },
    loyaltyTransaction: {
      create: vi.fn().mockResolvedValue({ id: "lt-1" }),
    },
  };
  return { tx, state };
}

describe("loyalty schema", () => {
  it("redeemPointsSchema rejects non-positive points", () => {
    expect(redeemPointsSchema.safeParse({ points: 0, transactionId: "t1" }).success).toBe(false);
    expect(redeemPointsSchema.safeParse({ points: 1, transactionId: "t1" }).success).toBe(true);
  });

  it("adjustPointsSchema enforces description bounds", () => {
    expect(adjustPointsSchema.safeParse({ userId: "u", points: 1, description: "" }).success).toBe(false);
    expect(
      adjustPointsSchema.safeParse({ userId: "u", points: 1, description: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("loyaltyHistoryQuery coerces page/limit", () => {
    const q = loyaltyHistoryQuery.parse({ page: "2", limit: "5" });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(5);
  });
});

describe("LoyaltyService.redeemPoints", () => {
  it("throws when membership missing", async () => {
    const tx = {
      customerMembership: { findUnique: vi.fn().mockResolvedValue(null) },
      loyaltyTransaction: { create: vi.fn() },
    };
    await expect(
      LoyaltyService.redeemPoints(tx as never, "u1", 10, "pos-1", 100_000),
    ).rejects.toThrow("Customer membership not found");
  });

  it("throws when insufficient points", async () => {
    const { tx } = buildTx();
    (tx.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "m1",
      userId: "cust-1",
      organizationId: "org-1",
      pointsBalance: 5,
    });
    await expect(
      LoyaltyService.redeemPoints(tx as never, "cust-1", 10, "pos-1", 100_000),
    ).rejects.toThrow("Insufficient loyalty points");
  });

  it("throws when redemption exceeds 50% of bill", async () => {
    const { tx } = buildTx();
    (tx.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "m1",
      userId: "cust-1",
      organizationId: "org-1",
      pointsBalance: 1000,
    });
    await expect(
      LoyaltyService.redeemPoints(tx as never, "cust-1", 100, "pos-1", 10_000),
    ).rejects.toThrow("50%");
  });

  it("redeems and returns discount", async () => {
    const { tx } = buildTx();
    (tx.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "m1",
      userId: "cust-1",
      organizationId: "org-1",
      pointsBalance: 20,
    });
    const result = await LoyaltyService.redeemPoints(tx as never, "cust-1", 10, "pos-1", 100_000);
    expect(result.pointsRedeemed).toBe(10);
    expect(result.discountAmount).toBe(5000);
    expect(tx.loyaltyTransaction.create).toHaveBeenCalled();
  });
});

describe("LoyaltyService.adjustPoints", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("throws when user not found", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      LoyaltyService.adjustPoints(db, "missing", 5, "bonus", "admin-1", "org-1"),
    ).rejects.toThrow("User not found");
  });

  it("throws when caller org mismatches user org", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ organizationId: "org-a" });
    await expect(
      LoyaltyService.adjustPoints(db, "u1", 5, "bonus", "admin-1", "org-b"),
    ).rejects.toThrow("User not in same organization");
  });

  it("upserts membership and logs transaction", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ organizationId: "org-1" })
      .mockResolvedValueOnce({ organizationId: "org-1" });
    (db.customerMembership.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "m1",
      pointsBalance: 10,
      lifetimePoints: 10,
    });
    (db.loyaltyTransaction.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await LoyaltyService.adjustPoints(db, "u1", 10, "Goodwill", "admin-1", "org-1");
    expect(db.customerMembership.upsert).toHaveBeenCalled();
    expect(db.loyaltyTransaction.create).toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});

describe("LoyaltyService.processPointExpiry", () => {
  it("zeros balances and writes loyalty transactions", async () => {
    const db = createMockDb();
    (db.customerMembership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "m1", organizationId: "org-1", pointsBalance: 15, userId: "u1" },
    ]);
    (db.customerMembership.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.loyaltyTransaction.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await LoyaltyService.processPointExpiry(db);
    expect(result.accountsProcessed).toBe(1);
    expect(result.totalExpired).toBe(15);
    expect(db.customerMembership.update).toHaveBeenCalled();
    expect(db.loyaltyTransaction.create).toHaveBeenCalled();
  });
});

describe("loyalty HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "LOYALTY", canUpdate: true }]);
  });

  it("returns 401 without Authorization for /me", async () => {
    const app = mountFeatureWithDb(loyaltyApp, db);
    const res = await app.request("http://t/me", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  it("returns 404 when loyalty account missing", async () => {
    const token = await signTestJwt({
      sub: "user-customer",
      organizationId: "org-1",
      tenantRoleId: "role-customer",
      scope: "CUSTOMER",
      isCustomer: true,
    });
    (db.customerMembership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(loyaltyApp, db);
    const res = await app.request("http://t/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain("Loyalty account not found");
  });

  it("returns 403 for admin adjust without LOYALTY update", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "admin-1",
      organizationId: "org-1",
      tenantRoleId: "role-no-perms",
      scope: "HQ",
      isCustomer: false,
    });
    const app = mountFeatureWithDb(loyaltyApp, db);
    const res = await app.request("http://t/admin/adjust", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "u2", points: 1, description: "adjustment note" }),
    }, env);
    expect(res.status).toBe(403);
  });
});
