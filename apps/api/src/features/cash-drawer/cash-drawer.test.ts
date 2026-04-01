import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  openSessionSchema,
  closeSessionSchema,
  addEntrySchema,
  currentSessionQuerySchema,
} from "./cash-drawer.schema";
import { CashDrawerService } from "./cash-drawer.service";
import cashDrawerApp from "./cash-drawer.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("cash-drawer.schema", () => {
  it("openSession rejects negative opening balance", () => {
    expect(
      openSessionSchema.safeParse({ branchId: "b1", openingBalance: -1 }).success,
    ).toBe(false);
    expect(openSessionSchema.safeParse({ branchId: "b1", openingBalance: 0 }).success).toBe(true);
  });

  it("closeSession requires sessionId", () => {
    expect(closeSessionSchema.safeParse({ closingBalance: 0 }).success).toBe(false);
  });

  it("addEntry accepts enum type", () => {
    expect(
      addEntrySchema.safeParse({
        sessionId: "s1",
        type: "INVALID",
        amount: 1,
      }).success,
    ).toBe(false);
    expect(
      addEntrySchema.safeParse({ sessionId: "s1", type: "FLOAT", amount: 100 }).success,
    ).toBe(true);
  });

  it("currentSessionQuery requires branchId", () => {
    expect(currentSessionQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("CashDrawerService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("openSession throws when session already open", async () => {
    (db.cashDrawerSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "open" });
    await expect(
      CashDrawerService.openSession(db, "b1", "u1", "org-1", 100),
    ).rejects.toThrow("already open");
  });

  it("addEntry throws when session missing", async () => {
    (db.cashDrawerSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      CashDrawerService.addEntry(db, "missing", "SALE", 10),
    ).rejects.toThrow("Session not found");
  });

  it("addEntry throws when session closed", async () => {
    (db.cashDrawerSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "CLOSED",
      organizationId: "org-1",
    });
    await expect(
      CashDrawerService.addEntry(db, "s1", "SALE", 10),
    ).rejects.toThrow("closed session");
  });

  it("closeSession throws when already closed", async () => {
    (db.cashDrawerSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      status: "CLOSED",
      openingBalance: 0,
      entries: [],
    });
    await expect(CashDrawerService.closeSession(db, "s1", 0)).rejects.toThrow("already closed");
  });
});

describe("cash-drawer HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "CASH_DRAWER", canCreate: true }]);
  });

  it("returns 401 without token", async () => {
    const app = mountFeatureWithDb(cashDrawerApp, db);
    const res = await app.request(
      "http://t/open",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: "b1", openingBalance: 0 }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without CASH_DRAWER create", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const app = mountFeatureWithDb(cashDrawerApp, db);
    const res = await app.request(
      "http://t/current?branchId=b1",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when open session duplicate", async () => {
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    (db.cashDrawerSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "x" });
    const app = mountFeatureWithDb(cashDrawerApp, db);
    const res = await app.request(
      "http://t/open",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchId: "b1", openingBalance: 0 }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when closing unknown session", async () => {
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    (db.cashDrawerSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(cashDrawerApp, db);
    const res = await app.request(
      "http://t/close",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: "nope", closingBalance: 0 }),
      },
    );
    expect(res.status).toBe(404);
  });
});
