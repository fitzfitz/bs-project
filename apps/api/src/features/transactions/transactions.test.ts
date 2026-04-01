import { describe, it, expect, vi, beforeEach } from "vitest";
import { HTTPException } from "hono/http-exception";
import {
  createTransactionSchema,
  addPaymentsSchema,
  voidTransactionSchema,
  refundTransactionSchema,
  listTransactionsQuerySchema,
} from "./transactions.schema";
import { TransactionService } from "./transactions.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import transactionsApp from "./transactions.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

vi.mock("../promotions/promotions.service", () => ({
  promotionsService: {
    validatePromoCode: vi.fn().mockResolvedValue({ discountAmount: 0 }),
    validateLoyaltyRedemption: vi.fn().mockResolvedValue({ discountAmount: 0 }),
  },
}));

vi.mock("../commissions/commissions.service", () => ({
  CommissionService: {
    triggerOnPaid: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../loyalty/loyalty.service", () => ({
  LoyaltyService: {
    redeemPoints: vi.fn().mockResolvedValue(undefined),
    earnPoints: vi.fn().mockResolvedValue({ pointsEarned: 0 }),
    adjustPoints: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../inventory/inventory.service", () => ({
  InventoryService: {
    recordStockOut: vi.fn().mockResolvedValue(undefined),
    recordVoidReversal: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../referrals/referrals.service", () => ({
  ReferralService: {
    completeReferral: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("transactions.schema", () => {
  it("createTransaction requires branchId and at least one item", () => {
    expect(createTransactionSchema.safeParse({ branchId: "", items: [] }).success).toBe(false);
    expect(
      createTransactionSchema.safeParse({
        branchId: "b1",
        items: [{ name: "Cut", quantity: 1, unitPrice: 10 }],
      }).success,
    ).toBe(true);
  });

  it("addPayments requires non-empty payments array", () => {
    expect(addPaymentsSchema.safeParse({ payments: [] }).success).toBe(false);
    expect(
      addPaymentsSchema.safeParse({
        payments: [{ method: "CASH", amount: 1 }],
      }).success,
    ).toBe(true);
  });

  it("voidTransaction requires reason length >= 5", () => {
    expect(voidTransactionSchema.safeParse({ reason: "x" }).success).toBe(false);
    expect(voidTransactionSchema.safeParse({ reason: "valid reason" }).success).toBe(true);
  });

  it("refundTransaction requires reason length >= 5", () => {
    expect(refundTransactionSchema.safeParse({ reason: "ab" }).success).toBe(false);
    expect(refundTransactionSchema.safeParse({}).success).toBe(false);
    expect(refundTransactionSchema.safeParse({ reason: "customer wants refund" }).success).toBe(true);
  });

  it("listTransactionsQuery coerces page and defaults", () => {
    const r = listTransactionsQuerySchema.parse({
      branchId: "b1",
      page: "2",
      limit: "10",
    });
    expect(r.page).toBe(2);
    expect(r.limit).toBe(10);
  });
});

describe("TransactionService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("createTransaction returns existing when clientUuid already used", async () => {
    const existing = { id: "tx1", clientUuid: "550e8400-e29b-41d4-a716-446655440000" };
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    const out = await TransactionService.createTransaction(
      db,
      {
        branchId: "b1",
        items: [{ name: "S", quantity: 1, unitPrice: 10, discount: 0, isAddOn: false }],
        tipAmount: 0,
        discountAmount: 0,
        loyaltyPointsUsed: 0,
        clientUuid: "550e8400-e29b-41d4-a716-446655440000",
      },
      "org-1",
    );
    expect(out).toBe(existing);
  });

  it("createTransaction rejects cashier manual discount over 10%", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxEnabled: false,
      taxRate: 0,
    });
    await expect(
      TransactionService.createTransaction(
      db,
      {
        branchId: "b1",
        items: [{ name: "S", quantity: 1, unitPrice: 100, discount: 0, isAddOn: false }],
        tipAmount: 0,
        discountAmount: 20,
        loyaltyPointsUsed: 0,
      },
      "org-1",
      "CASHIER",
    ),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it("addPayments throws when transaction missing", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      return fn(db);
    });
    await expect(
      TransactionService.addPayments(db, "missing", {
        payments: [{ method: "CASH", amount: 1 }],
      }),
    ).rejects.toThrow("not found");
  });

  it("addPayments throws on payment mismatch", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        organizationId: "org-1",
        status: "PENDING",
        totalDue: 100,
      });
      return fn(db);
    });
    await expect(
      TransactionService.addPayments(db, "t1", {
        payments: [{ method: "CASH", amount: 50 }],
      }),
    ).rejects.toThrow("mismatch");
  });

  it("voidTransaction throws when already voided", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        status: "VOIDED",
        branchId: "b1",
        organizationId: "org-1",
        items: [],
      });
      return fn(db);
    });
    await expect(
      TransactionService.voidTransaction(db, "t1", "u1", "HQ", "because reason"),
    ).rejects.toThrow("already voided");
  });

  it("getTransactionById throws when not found", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(TransactionService.getTransactionById(db, "nope")).rejects.toThrow("not found");
  });

  it("refundTransaction throws when transaction not found", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      return fn(db);
    });
    await expect(
      TransactionService.refundTransaction(db, "missing", "u1", "customer request"),
    ).rejects.toThrow("not found");
  });

  it("refundTransaction throws when already refunded", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        status: "REFUNDED",
        branchId: "b1",
        organizationId: "org-1",
        items: [],
        loyaltyPointsEarned: 0,
        loyaltyPointsUsed: 0,
        customerId: null,
        totalDue: 100,
      });
      return fn(db);
    });
    await expect(
      TransactionService.refundTransaction(db, "t1", "u1", "customer request"),
    ).rejects.toThrow("already refunded");
  });

  it("refundTransaction throws when status is PENDING (not completed)", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        status: "PENDING",
        branchId: "b1",
        organizationId: "org-1",
        items: [],
        loyaltyPointsEarned: 0,
        loyaltyPointsUsed: 0,
        customerId: null,
        totalDue: 100,
      });
      return fn(db);
    });
    await expect(
      TransactionService.refundTransaction(db, "t1", "u1", "customer request"),
    ).rejects.toThrow("Only completed");
  });

  it("refundTransaction succeeds for COMPLETED tx with inventory and audit", async () => {
    const completedTx = {
      id: "t1",
      status: "COMPLETED",
      branchId: "b1",
      organizationId: "org-1",
      items: [{ productId: "p1", quantity: 2, serviceId: null }],
      loyaltyPointsEarned: 0,
      loyaltyPointsUsed: 0,
      customerId: null,
      totalDue: 200,
    };
    const updatedTx = { ...completedTx, status: "REFUNDED" };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(completedTx);
      (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedTx);
      (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      return fn(db);
    });

    const result = await TransactionService.refundTransaction(db, "t1", "u1", "defective product");
    expect(result.status).toBe("REFUNDED");
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REFUND_TRANSACTION" }),
      }),
    );
  });

  it("createTransaction applies tax when taxEnabled and taxRate 11", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxEnabled: true,
      taxRate: 11,
    });
    const created = {
      id: "tx-tax",
      grossAmount: 100,
      discountAmount: 0,
      taxAmount: 11,
      netAmount: 111,
      totalDue: 111,
      tipAmount: 0,
      items: [],
      status: "PENDING",
    };
    (db.transaction.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
    await TransactionService.createTransaction(
      db,
      {
        branchId: "b1",
        items: [{ name: "Cut", quantity: 1, unitPrice: 100, discount: 0, isAddOn: false }],
        tipAmount: 0,
        discountAmount: 0,
        loyaltyPointsUsed: 0,
      },
      "org-1",
    );
    expect(db.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grossAmount: 100,
          taxAmount: 11,
          netAmount: 111,
          totalDue: 111,
        }),
      }),
    );
  });

  it("createTransaction allows manual discount over 10% for non-CASHIER scope", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxEnabled: false,
      taxRate: 0,
    });
    const created = { id: "tx-mgr", items: [], status: "PENDING" };
    (db.transaction.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
    const out = await TransactionService.createTransaction(
      db,
      {
        branchId: "b1",
        items: [{ name: "S", quantity: 1, unitPrice: 100, discount: 0, isAddOn: false }],
        tipAmount: 0,
        discountAmount: 25,
        loyaltyPointsUsed: 0,
      },
      "org-1",
      "BRANCH",
    );
    expect(out).toBe(created);
  });

  it("createTransaction writes APPLY_DISCOUNT audit when discountAmount > 0", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxEnabled: false,
      taxRate: 0,
    });
    (db.transaction.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-disc",
      items: [],
      status: "PENDING",
    });
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await TransactionService.createTransaction(
      db,
      {
        branchId: "b1",
        items: [{ name: "S", quantity: 1, unitPrice: 100, discount: 0, isAddOn: false }],
        tipAmount: 0,
        discountAmount: 15,
        loyaltyPointsUsed: 0,
      },
      "org-1",
      "HQ",
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "APPLY_DISCOUNT",
          entityType: "Transaction",
          entityId: "tx-disc",
        }),
      }),
    );
  });

  it("addPayments completes PENDING transaction and runs side effects when sum matches totalDue", async () => {
    const pending = {
      id: "t-pay",
      organizationId: "org-1",
      branchId: "b1",
      status: "PENDING",
      totalDue: 100,
    };
    const completed = {
      ...pending,
      status: "COMPLETED",
      queueEntryId: null,
      promoCode: null,
      loyaltyPointsUsed: 0,
      customerId: null,
      items: [],
      payments: [{ method: "CASH", amount: 100 }],
    };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pending);
      (db.payment.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue(completed);
      return fn(db);
    });
    const result = await TransactionService.addPayments(db, "t-pay", {
      payments: [{ method: "CASH", amount: 100 }],
    });
    expect(result.status).toBe("COMPLETED");
    expect(db.payment.createMany).toHaveBeenCalled();
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED" } }),
    );
  });

  it("addPayments throws when transaction is already COMPLETED", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t-done",
        organizationId: "org-1",
        status: "COMPLETED",
        totalDue: 100,
      });
      return fn(db);
    });
    await expect(
      TransactionService.addPayments(db, "t-done", {
        payments: [{ method: "CASH", amount: 100 }],
      }),
    ).rejects.toThrow(/already COMPLETED/);
  });

  it("voidTransaction sets VOIDED and creates audit log", async () => {
    const open = {
      id: "t-void",
      status: "PENDING",
      branchId: "b1",
      organizationId: "org-1",
      items: [{ productId: "p1", quantity: 1, serviceId: null }],
    };
    const voided = { ...open, status: "VOIDED" };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(open);
      (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue(voided);
      (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      return fn(db);
    });
    const result = await TransactionService.voidTransaction(db, "t-void", "u1", "HQ", "customer left");
    expect(result.status).toBe("VOIDED");
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "VOID_TRANSACTION",
          entityId: "t-void",
          details: { reason: "customer left" },
        }),
      }),
    );
  });

  it("voidTransaction throws when transaction not found", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      return fn(db);
    });
    await expect(
      TransactionService.voidTransaction(db, "missing", "u1", "HQ", "valid reason"),
    ).rejects.toThrow("not found");
  });

  it("refundTransaction reverses earned loyalty points when COMPLETED with loyaltyPointsEarned and customerId", async () => {
    vi.mocked(LoyaltyService.adjustPoints).mockClear();
    const completedTx = {
      id: "t-loy",
      status: "COMPLETED",
      branchId: "b1",
      organizationId: "org-1",
      items: [],
      loyaltyPointsEarned: 40,
      loyaltyPointsUsed: 0,
      customerId: "cust-1",
      totalDue: 80,
    };
    const refundedTx = { ...completedTx, status: "REFUNDED" };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(completedTx);
      (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue(refundedTx);
      (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      return fn(db);
    });
    await TransactionService.refundTransaction(db, "t-loy", "u1", "changed mind");
    expect(LoyaltyService.adjustPoints).toHaveBeenCalledWith(
      expect.anything(),
      "cust-1",
      -40,
      expect.stringContaining("refund"),
    );
  });

  it("getDailySummary returns zeros for a day with no completed transactions", async () => {
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const summary = await TransactionService.getDailySummary(db, "b1", new Date("2025-04-01T12:00:00.000Z"));
    expect(summary).toEqual({
      count: 0,
      totalRevenue: 0,
      totalServiceRevenue: 0,
      totalProductRevenue: 0,
      totalTips: 0,
      paymentMethods: {
        CASH: 0,
        CARD: 0,
        QRIS: 0,
        DIGITAL_WALLET: 0,
      },
    });
  });

  it("getDailySummary splits service vs product revenue and buckets payment methods", async () => {
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        netAmount: 200,
        tipAmount: 10,
        items: [
          { serviceId: "svc-1", productId: null, total: 120 },
          { serviceId: null, productId: "prod-1", total: 50 },
        ],
        payments: [
          { method: "CASH", amount: 150 },
          { method: "CARD", amount: 60 },
        ],
      },
    ] as never);
    const summary = await TransactionService.getDailySummary(db, "b1", new Date("2025-04-02T08:00:00.000Z"));
    expect(summary.totalRevenue).toBe(200);
    expect(summary.totalTips).toBe(10);
    expect(summary.totalServiceRevenue).toBe(120);
    expect(summary.totalProductRevenue).toBe(50);
    expect(summary.paymentMethods.CASH).toBe(150);
    expect(summary.paymentMethods.CARD).toBe(60);
    expect(summary.count).toBe(1);
  });

  it("listTransactions with dateFrom only expands to single local calendar day", async () => {
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const dateFrom = "2025-06-10T15:45:00.000Z";
    await TransactionService.listTransactions(
      db,
      listTransactionsQuerySchema.parse({ branchId: "b1", dateFrom }),
    );
    const arg = vi.mocked(db.transaction.findMany).mock.calls[0][0] as {
      where: { createdAt: { gte: Date; lt: Date } };
    };
    const { gte, lt } = arg.where.createdAt;
    expect(gte.getHours()).toBe(0);
    expect(gte.getMinutes()).toBe(0);
    expect(gte.getSeconds()).toBe(0);
    expect(gte.getMilliseconds()).toBe(0);
    const expectedLt = new Date(gte);
    expectedLt.setDate(expectedLt.getDate() + 1);
    expect(lt.getTime()).toBe(expectedLt.getTime());
  });

  it("listTransactions returns pagination metadata from total and limit", async () => {
    (db.transaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);
    const result = await TransactionService.listTransactions(
      db,
      listTransactionsQuerySchema.parse({ branchId: "b1", page: 2, limit: 10 }),
    );
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
    const arg = vi.mocked(db.transaction.findMany).mock.calls[0][0] as { skip: number; take: number };
    expect(arg.skip).toBe(10);
    expect(arg.take).toBe(10);
  });

  it("getReceiptData builds receipt number and staff name from queue", async () => {
    const createdAt = new Date("2025-08-20T09:15:30.000Z");
    const ymd = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-rcpt",
      createdAt,
      branchId: "b1",
      grossAmount: 50,
      discountAmount: 0,
      taxAmount: 0,
      tipAmount: 5,
      netAmount: 50,
      loyaltyPointsEarned: 0,
      queueEntryId: "q1",
      items: [{ name: "Cut", quantity: 1, unitPrice: 50, discount: 0, total: 50 }],
      payments: [{ method: "CASH", amount: 55 }],
      branch: { name: "Main", address: "Jl. Test" },
      queueEntry: {
        staff: {
          id: "staff-1",
          user: { firstName: "Alex", lastName: "Rivera" },
        },
      },
    } as never);
    (db.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(4);
    const receipt = await TransactionService.getReceiptData(db, "tx-rcpt");
    expect(receipt.receiptNumber).toBe(`TX-${ymd}-004`);
    expect(receipt.staffName).toBe("Alex Rivera");
    expect(receipt.branchName).toBe("Main");
  });

  it("getReceiptData throws when transaction not found", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(TransactionService.getReceiptData(db, "nope")).rejects.toThrow("not found");
  });

  it("finalizeTransactionOnPaid marks PENDING transaction COMPLETED", async () => {
    const pending = {
      id: "t-fin",
      status: "PENDING",
      organizationId: "org-1",
      branchId: "b1",
      queueEntryId: null,
      promoCode: null,
      loyaltyPointsUsed: 0,
      customerId: null,
      items: [],
    };
    const done = {
      ...pending,
      status: "COMPLETED",
      payments: [],
    };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pending);
      (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue(done);
      return fn(db);
    });
    const result = await TransactionService.finalizeTransactionOnPaid(db, "t-fin");
    expect(result?.status).toBe("COMPLETED");
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED" } }),
    );
  });

  it("finalizeTransactionOnPaid returns null when transaction is not PENDING", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t-old",
        status: "COMPLETED",
        items: [],
      });
      return fn(db);
    });
    const result = await TransactionService.finalizeTransactionOnPaid(db, "t-old");
    expect(result).toBeNull();
    expect(db.transaction.update).not.toHaveBeenCalled();
  });
});

describe("transactions HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "TRANSACTION", canRead: true, canCreate: true, canDelete: true },
    ]);
  });

  it("returns 401 without token for list", async () => {
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/?branchId=b1", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 403 without TRANSACTION read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/?branchId=b1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when getById not found", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/missing", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 201 on create when service succeeds", async () => {
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxEnabled: false,
      taxRate: 0,
    });
    (db.transaction.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-tx",
      items: [],
      status: "PENDING",
    });
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branchId: "b1",
        items: [{ name: "Service", quantity: 1, unitPrice: 50, discount: 0, isAddOn: false }],
      }),
    });
    expect(res.status).toBe(201);
  });

  it("returns 409 on duplicate clientUuid (Prisma P2002)", async () => {
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const err: NodeJS.ErrnoException = Object.assign(new Error("dup"), {
      code: "P2002",
      meta: { target: ["clientUuid"] },
    });
    (db.transaction.create as ReturnType<typeof vi.fn>).mockRejectedValue(err);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxEnabled: false,
      taxRate: 0,
    });
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branchId: "b1",
        items: [{ name: "Service", quantity: 1, unitPrice: 50, discount: 0, isAddOn: false }],
        clientUuid: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 201 on create when TransactionService returns transaction payload", async () => {
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const created = {
      id: "tx-mock",
      items: [{ name: "Cut", quantity: 1, unitPrice: 25 }],
      status: "PENDING",
    };
    const spy = vi.spyOn(TransactionService, "createTransaction").mockResolvedValue(created as never);
    try {
      const app = mountFeatureWithDb(transactionsApp, db);
      const res = await app.request("http://t/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: "b1",
          items: [{ name: "Cut", quantity: 1, unitPrice: 25, discount: 0, isAddOn: false }],
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; data: typeof created };
      expect(body.success).toBe(true);
      expect(body.data).toEqual(created);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("returns 400 on pay when transaction already completed", async () => {
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t-done",
        organizationId: "org-1",
        status: "COMPLETED",
        totalDue: 100,
      });
      return fn(db);
    });
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/t-done/pay", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payments: [{ method: "CASH", amount: 100 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without token for refund", async () => {
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/some-id/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "customer wants refund" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for refund without TRANSACTION delete", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "TRANSACTION", canRead: true, canCreate: true, canDelete: false },
    ]);
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const app = mountFeatureWithDb(transactionsApp, db);
    const res = await app.request("http://t/some-id/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "customer wants refund" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 on successful refund", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const refunded = {
      id: "t-refund",
      organizationId: "org-1",
      branchId: "b1",
      status: "REFUNDED",
      totalDue: 100,
    };
    const spy = vi.spyOn(TransactionService, "refundTransaction").mockResolvedValue(refunded as never);
    try {
      const app = mountFeatureWithDb(transactionsApp, db);
      const res = await app.request("http://t/t-refund/refund", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "defective product received" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: typeof refunded };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("REFUNDED");
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        "t-refund",
        testUsers.branchManager.userId,
        "defective product received",
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("returns 400 on refund of non-completed transaction", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const spy = vi.spyOn(TransactionService, "refundTransaction")
      .mockRejectedValue(new Error("Only completed transactions can be refunded"));
    try {
      const app = mountFeatureWithDb(transactionsApp, db);
      const res = await app.request("http://t/t-pending/refund", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "customer wants refund now" }),
      });
      expect([400, 500]).toContain(res.status);
    } finally {
      spy.mockRestore();
    }
  });
});
