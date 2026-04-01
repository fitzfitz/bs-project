import { describe, it, expect, vi, beforeEach } from "vitest";
import { HTTPException } from "hono/http-exception";
import { DiscountType } from "@prisma/client";
import promotionsApp from "./promotions.index";
import {
  CreatePromoCodeSchema,
  ValidatePromoCodeSchema,
} from "./promotions.schema";
import { promotionsService } from "./promotions.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

const basePromoInput = {
  code: "SAVE10",
  description: "ten percent",
  type: DiscountType.PERCENTAGE,
  value: 10,
  minGrossAmount: 50_000,
  maxDiscount: 50_000,
  usageLimit: 100,
  startDate: new Date().toISOString(),
  endDate: null,
  isActive: true,
  branchId: null,
};

describe("promotions schema", () => {
  it("CreatePromoCodeSchema accepts valid payload", () => {
    const r = CreatePromoCodeSchema.safeParse(basePromoInput);
    expect(r.success).toBe(true);
  });

  it("ValidatePromoCodeSchema requires code branchId grossAmount", () => {
    expect(ValidatePromoCodeSchema.safeParse({ code: "X", branchId: "b1" }).success).toBe(false);
    expect(
      ValidatePromoCodeSchema.safeParse({ code: "X", branchId: "b1", grossAmount: 1000 }).success,
    ).toBe(true);
  });
});

describe("PromotionsService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("validatePromoCode throws 400 when organizationId missing", async () => {
    await expect(
      promotionsService.validatePromoCode(db, {
        code: "X",
        branchId: "b1",
        grossAmount: 100_000,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("validatePromoCode throws 404 when code unknown", async () => {
    (db.promoCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      promotionsService.validatePromoCode(db, {
        code: "NONE",
        branchId: "b1",
        grossAmount: 100_000,
        organizationId: "org-1",
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof HTTPException && e.status === 404);
  });

  it("validatePromoCode throws 400 when promo inactive", async () => {
    (db.promoCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: "X",
      isActive: false,
      branchId: null,
      startDate: new Date(Date.now() - 86400_000),
      endDate: null,
      usageLimit: null,
      usageCount: 0,
      minGrossAmount: 0,
      type: DiscountType.PERCENTAGE,
      value: 10,
      maxDiscount: null,
    });
    await expect(
      promotionsService.validatePromoCode(db, {
        code: "X",
        branchId: "b1",
        grossAmount: 100_000,
        organizationId: "org-1",
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof HTTPException && e.status === 400);
  });

  it("validatePromoCode returns discount for active percentage promo", async () => {
    (db.promoCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: "P10",
      isActive: true,
      branchId: null,
      startDate: new Date(Date.now() - 86400_000),
      endDate: null,
      usageLimit: null,
      usageCount: 0,
      minGrossAmount: 0,
      type: DiscountType.PERCENTAGE,
      value: 10,
      maxDiscount: null,
    });
    const out = await promotionsService.validatePromoCode(db, {
      code: "P10",
      branchId: "b1",
      grossAmount: 100_000,
      organizationId: "org-1",
    });
    expect(out.discountAmount).toBe(10_000);
    expect(out.promoCode).toBe("P10");
  });

  it("validateLoyaltyRedemption throws 404 without membership", async () => {
    (db.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      promotionsService.validateLoyaltyRedemption(db, "u1", 10, 100_000),
    ).rejects.toSatisfy((e: unknown) => e instanceof HTTPException && e.status === 404);
  });

  it("validateLoyaltyRedemption throws 400 on insufficient points", async () => {
    (db.customerMembership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      pointsBalance: 2,
    });
    await expect(
      promotionsService.validateLoyaltyRedemption(db, "u1", 10, 100_000),
    ).rejects.toSatisfy((e: unknown) => e instanceof HTTPException && e.status === 400);
  });

  it("updatePromoCode throws 404 when missing", async () => {
    (db.promoCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(promotionsService.updatePromoCode(db, "missing", { isActive: false })).rejects.toSatisfy(
      (e: unknown) => e instanceof HTTPException && e.status === 404,
    );
  });
});

describe("promotions HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "PROMOTIONS", canCreate: true }]);
  });

  it("GET / returns 401 without Authorization", async () => {
    const app = mountFeatureWithDb(promotionsApp, db);
    const res = await app.request("http://t/", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  it("GET / returns 200 with promo array when authenticated", async () => {
    (db.promoCode.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const app = mountFeatureWithDb(promotionsApp, db);
    const res = await app.request("http://t/", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
  });

  it("POST / returns 403 without PROMOTIONS create", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const app = mountFeatureWithDb(promotionsApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(basePromoInput),
    }, env);
    expect(res.status).toBe(403);
  });
});
