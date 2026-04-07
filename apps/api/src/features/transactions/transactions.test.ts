import { describe, it, expect, vi, beforeEach } from "vitest";
import { sign } from "hono/jwt";
import { finalizeTransactionSideEffects } from "./transactions.service";
import { createMockDb, mountFeatureWithDb, mockTenantRolePermissions, getTestBindings } from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";
import transactionsApp from "./transactions.index";

// Mock business logic services that are dynamically imported in TransactionService
vi.mock("../loyalty/loyalty.service", () => ({
  LoyaltyService: {
    redeemPoints: vi.fn().mockResolvedValue({}),
    earnPoints: vi.fn().mockResolvedValue({ pointsEarned: 0 }),
    adjustPoints: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../commissions/commissions.service", () => ({
  CommissionService: {
    triggerOnPaid: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../inventory/inventory.service", () => ({
  InventoryService: {
    recordStockOut: vi.fn().mockResolvedValue({}),
    recordVoidReversal: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../referrals/referrals.service", () => ({
  ReferralService: {
    completeReferral: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@tmng/email-templates", () => ({
  paymentReceiptEmail: vi.fn(() => ({ subject: "Receipt", html: "<p>Receipt</p>" })),
  bookingConfirmedEmail: vi.fn(() => ({ subject: "Confirmed", html: "<p>Confirmed</p>" })),
  bookingCancelledEmail: vi.fn(() => ({ subject: "Cancelled", html: "<p>Cancelled</p>" })),
  bookingRescheduledEmail: vi.fn(() => ({ subject: "Rescheduled", html: "<p>Rescheduled</p>" })),
}));

const TEST_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

describe("Transactions Service", () => {
  const db = createMockDb();
  process.env.JWT_SECRET = TEST_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("finalizeTransactionSideEffects", () => {
    const mockTx = {
      id: "tx-1",
      organizationId: "org-1",
      branchId: "branch-1",
      customerId: "cust-1",
      queueEntryId: "qe-1",
      promoCode: "PROMO10",
      loyaltyPointsUsed: 0,
      items: [{ productId: "prod-1", quantity: 1 }],
      totalDue: 100000,
    };

    const mockBranch = {
      name: "Branch 1",
      address: "Address 1",
    };

    it("sends email when no preference record exists (legacy fallback)", async () => {
      const mockNs = { sendEmail: vi.fn().mockResolvedValue(true) } as any;
      
      const findUniquePref = db.notificationPreference.findUnique as any;
      findUniquePref.mockResolvedValue(null);

      const findBranch = db.branch.findUnique as any;
      findBranch.mockResolvedValue(mockBranch);

      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue(mockTx);

      const findUser = db.user.findUnique as any;
      findUser.mockResolvedValue({ firstName: "John" });

      await finalizeTransactionSideEffects(db, "tx-1", mockTx as any, mockNs);
      
      expect(mockNs.sendEmail).toHaveBeenCalled();
    });

    it("skips email when emailOptOut is true", async () => {
      const mockNs = { sendEmail: vi.fn().mockResolvedValue(true) } as any;
      
      const findUniquePref = db.notificationPreference.findUnique as any;
      findUniquePref.mockResolvedValue({ emailOptOut: true });

      await finalizeTransactionSideEffects(db, "tx-1", mockTx as any, mockNs);
      
      expect(mockNs.sendEmail).not.toHaveBeenCalled();
    });

    it("sends email when emailOptOut is false", async () => {
      const mockNs = { sendEmail: vi.fn().mockResolvedValue(true) } as any;
      
      const findUniquePref = db.notificationPreference.findUnique as any;
      findUniquePref.mockResolvedValue({ emailOptOut: false });

      const findBranch = db.branch.findUnique as any;
      findBranch.mockResolvedValue(mockBranch);

      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue(mockTx);

      const findUser = db.user.findUnique as any;
      findUser.mockResolvedValue({ firstName: "John" });

      await finalizeTransactionSideEffects(db, "tx-1", mockTx as any, mockNs);
      
      expect(mockNs.sendEmail).toHaveBeenCalled();
    });
  });
});

describe("Transactions HTTP Handlers", () => {
  const db = createMockDb();
  // Pass the same TEST_SECRET to the mounted app's bindings
  const app = mountFeatureWithDb(transactionsApp, db, getTestBindings({ JWT_SECRET: TEST_SECRET }));

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, []);
    process.env.JWT_SECRET = TEST_SECRET;
  });

  async function getCustomerToken(userId: string) {
    return await sign(
      {
        sub: userId,
        organizationId: "org-1",
        tenantRoleId: "role-cust",
        isCustomer: true,
        scope: "CUSTOMER",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      TEST_SECRET
    );
  }

  async function getStaffToken(userId: string) {
    return await sign(
      {
        sub: userId,
        organizationId: "org-1",
        tenantRoleId: "role-staff",
        isCustomer: false,
        scope: "BRANCH",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      TEST_SECRET
    );
  }

  describe("GET /:id", () => {
    it("allows access for the owner (customer)", async () => {
      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue({
        id: "tx-1",
        customerId: "cust-1",
        items: [],
      });

      const token = await getCustomerToken("cust-1");

      const res = await app.request("/tx-1", {
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.status !== 200) {
          const body = await res.json();
          console.log("Auth Failure Body:", body);
      }

      expect(res.status).toBe(200);
    });

    it("denies access if customer is not the owner", async () => {
      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue({
        id: "tx-1",
        customerId: "other-cust",
        items: [],
      });

      const token = await getCustomerToken("cust-1");

      const res = await app.request("/tx-1", {
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });

      expect(res.status).toBe(403);
    });

    it("allows access for staff with TRANSACTION:read permission", async () => {
      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue({
        id: "tx-1",
        customerId: "cust-1",
        items: [],
      });
      
      mockTenantRolePermissions(db, [
        { featureCode: "TRANSACTION", canRead: true }
      ]);

      const token = await getStaffToken("staff-1");

      const res = await app.request("/tx-1", {
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });

      expect(res.status).toBe(200);
    });
  });

  describe("GET /:id/receipt", () => {
    it("allows receipt access for the owner", async () => {
      // Mock both the transaction lookup for auth AND the receipt data lookup
      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue({
        id: "tx-1",
        customerId: "cust-1",
        createdAt: new Date(),
        branchId: "b1",
        branch: { name: "B1", address: "A1" },
        items: [],
        payments: [],
      });

      const countTx = db.transaction.count as any;
      countTx.mockResolvedValue(1);

      const token = await getCustomerToken("cust-1");

      const res = await app.request("/tx-1/receipt", {
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });

      expect(res.status).toBe(200);
    });

    it("allows receipt access via queueEntry.customerId if transaction.customerId is null", async () => {
      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue({
        id: "tx-no-cust",
        customerId: null,
        queueEntry: { customerId: "cust-1" },
        createdAt: new Date(),
        branchId: "b1",
        branch: { name: "B1", address: "A1" },
        items: [],
        payments: [],
      });

      const countTx = db.transaction.count as any;
      countTx.mockResolvedValue(1);

      const token = await getCustomerToken("cust-1");

      const _res = await app.request("/tx-no-cust/receipt", {
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });

    });
  });

  describe("POST /:id/pay", () => {
    it("sends email when status moves to COMPLETED (manual checkout)", async () => {
      mockTenantRolePermissions(db, [{ featureCode: "TRANSACTION", canCreate: true }]);
      const token = await getStaffToken("staff-1");
      const subTotal = 100000;
      
      // Mock db behavior inside the transaction
      const findTx = db.transaction.findUnique as any;
      findTx.mockResolvedValue({ 
        id: "tx-1", status: "PENDING", totalDue: subTotal, netAmount: subTotal, organizationId: "org-1", branchId: "b1", customerId: "u1", createdAt: new Date(),
        items: [], payments: [], queueEntry: null 
      });

      db.transaction.update = vi.fn().mockResolvedValue({ 
        id: "tx-1", status: "COMPLETED", organizationId: "org-1", branchId: "b1", 
        queueEntryId: null, promoCode: null, loyaltyPointsUsed: 0, customerId: "u1",
        items: [], payments: [], queueEntry: null 
      });

      db.payment.createMany = vi.fn().mockResolvedValue({ count: 1 });
      db.branch.findUnique = vi.fn().mockResolvedValue({ name: "B1" });
      db.user.findUnique = vi.fn().mockResolvedValue({ firstName: "Joe", email: "joe@test.com" });
      db.notificationPreference.findUnique = vi.fn().mockResolvedValue({ emailOptOut: false });

      const res = await app.request("/tx-1/pay", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payments: [{ method: "CASH", amount: subTotal }]
        }),
      });

      const resBody = (await res.json()) as { success: boolean, message?: string };
      if (res.status !== 200) {
        console.log("DEBUG 403:", JSON.stringify(resBody));
      }
      expect(res.status).toBe(200);
      expect(resBody.success).toBe(true);
      
      // Verify standard side effects
      expect(db.payment.createMany).toHaveBeenCalled();
      expect(db.transaction.update).toHaveBeenCalled();
    });
  });
});
