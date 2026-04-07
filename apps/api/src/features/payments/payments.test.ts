import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockDb, mountFeatureWithDb, getTestBindings, signTestJwt, testUsers, mockTenantRolePermissions } from "../../test/helpers";
import { xenditWebhookBodySchema, createChargeSchema, savePaymentMethodSchema } from "./payments.schema";
import paymentsApp from "./payments.index";
import { TransactionService } from "../transactions/transactions.service";
import { invalidatePermissionCache } from "../../middlewares/rbac";

vi.mock("../transactions/transactions.service", async (importOriginal) => {
  const mod = await importOriginal<
    typeof import("../transactions/transactions.service")
  >();
  return {
    TransactionService: {
      ...mod.TransactionService,
      finalizeTransactionOnPaid: vi.fn().mockResolvedValue({ id: "tx-1" }),
    },
  };
});

vi.mock("../../utils/xendit-adapter", () => ({
  createXenditInvoice: vi.fn().mockResolvedValue({
    id: "xendit-inv-123",
    invoice_url: "https://checkout.xendit.co/inv-123",
  }),
}));

describe("payments.schema", () => {
  it("parses xendit webhook body", () => {
    const b = xenditWebhookBodySchema.parse({
      id: "inv_1",
      external_id: "ext",
      status: "PAID",
    });
    expect(b.status).toBe("PAID");
  });

  it("rejects missing fields", () => {
    expect(xenditWebhookBodySchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("payments webhook HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    db = createMockDb();
    app = mountFeatureWithDb(paymentsApp, db);
    vi.clearAllMocks();
    vi.mocked(TransactionService.finalizeTransactionOnPaid).mockResolvedValue({ id: "tx-1" } as never);
  });

  it("returns 401 when callback token invalid", async () => {
    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "bad" },
        body: JSON.stringify({ id: "i", external_id: "e", status: "PAID" }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "good" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 for non-PAID without finalize", async () => {
    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: JSON.stringify({ id: "i", external_id: "e", status: "PENDING" }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(200);
    expect(TransactionService.finalizeTransactionOnPaid).not.toHaveBeenCalled();
  });

  it("returns 200 when PAID but payment not found", async () => {
    (db.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: JSON.stringify({ id: "inv-x", external_id: "e", status: "PAID" }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(200);
    expect(TransactionService.finalizeTransactionOnPaid).not.toHaveBeenCalled();
  });

  it("calls finalize when PAID and payment exists", async () => {
    (db.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      transactionId: "tx-99",
    });

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: JSON.stringify({ id: "inv-x", external_id: "e", status: "PAID" }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(200);
    expect(TransactionService.finalizeTransactionOnPaid).toHaveBeenCalledWith(db, "tx-99", expect.anything());
  });

  it("returns 500 when finalize throws", async () => {
    (db.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      transactionId: "tx-99",
    });
    vi.mocked(TransactionService.finalizeTransactionOnPaid).mockRejectedValueOnce(new Error("boom"));

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: JSON.stringify({ id: "inv-x", external_id: "e", status: "PAID" }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 when webhook body fails schema validation", async () => {
    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: JSON.stringify({ id: "only-id" }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: "{",
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with success envelope for valid PAID payload", async () => {
    (db.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-callback-token": "tok" },
        body: JSON.stringify({
          id: "inv-valid",
          external_id: "ext-1",
          status: "PAID",
        }),
      },
      { ...getTestBindings(), XENDIT_WEBHOOK_TOKEN: "tok" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body).toEqual({ success: true });
  });
});

describe("payments create-charge schema", () => {
  it("requires transactionId", () => {
    expect(createChargeSchema.safeParse({ successRedirectUrl: "http://ok", failureRedirectUrl: "http://fail" }).success).toBe(false);
  });

  it("requires redirect URLs", () => {
    expect(createChargeSchema.safeParse({ transactionId: "tx-1" }).success).toBe(false);
  });

  it("accepts valid input", () => {
    const r = createChargeSchema.safeParse({
      transactionId: "tx-1",
      successRedirectUrl: "https://example.com/success",
      failureRedirectUrl: "https://example.com/fail",
    });
    expect(r.success).toBe(true);
  });
});

describe("payments create-charge HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    db = createMockDb();
    app = mountFeatureWithDb(paymentsApp, db, {
      ...getTestBindings(),
      XENDIT_SECRET_KEY: "xnd_test_key",
      XENDIT_WEBHOOK_TOKEN: "tok",
    });
    invalidatePermissionCache(testUsers.cashier.tenantRoleId);
    vi.clearAllMocks();
  });

  it("returns 401 without auth token", async () => {
    const res = await app.request("/create-charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionId: "tx-1",
        successRedirectUrl: "https://ok.com",
        failureRedirectUrl: "https://fail.com",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when transaction not found", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "TRANSACTION", canCreate: true, canRead: true }]);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const cashierJwt = { sub: testUsers.cashier.userId, organizationId: testUsers.cashier.organizationId, tenantRoleId: testUsers.cashier.tenantRoleId, branchId: testUsers.cashier.branchId, scope: testUsers.cashier.scope, isCustomer: testUsers.cashier.isCustomer };
    const token = await signTestJwt(cashierJwt);
    const res = await app.request("/create-charge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transactionId: "tx-missing",
        successRedirectUrl: "https://ok.com",
        failureRedirectUrl: "https://fail.com",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when transaction already completed", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "TRANSACTION", canCreate: true, canRead: true }]);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-done",
      status: "COMPLETED",
      totalDue: 100,
      organizationId: "org-1",
    });

    const cashierJwt = { sub: testUsers.cashier.userId, organizationId: testUsers.cashier.organizationId, tenantRoleId: testUsers.cashier.tenantRoleId, branchId: testUsers.cashier.branchId, scope: testUsers.cashier.scope, isCustomer: testUsers.cashier.isCustomer };
    const token = await signTestJwt(cashierJwt);
    const res = await app.request("/create-charge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transactionId: "tx-done",
        successRedirectUrl: "https://ok.com",
        failureRedirectUrl: "https://fail.com",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 201 with invoice URL on success", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "TRANSACTION", canCreate: true, canRead: true }]);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-1",
      status: "PENDING",
      totalDue: 50000,
      organizationId: "org-1",
    });
    (db.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pay-1" });

    const cashierJwt = { sub: testUsers.cashier.userId, organizationId: testUsers.cashier.organizationId, tenantRoleId: testUsers.cashier.tenantRoleId, branchId: testUsers.cashier.branchId, scope: testUsers.cashier.scope, isCustomer: testUsers.cashier.isCustomer };
    const token = await signTestJwt(cashierJwt);
    const res = await app.request("/create-charge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transactionId: "tx-1",
        successRedirectUrl: "https://ok.com/success",
        failureRedirectUrl: "https://ok.com/fail",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { invoiceId: string; invoiceUrl: string } };
    expect(body.success).toBe(true);
    expect(body.data.invoiceId).toBe("xendit-inv-123");
    expect(body.data.invoiceUrl).toContain("xendit.co");
  });

  it("links customerId if it is null during create-charge", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "TRANSACTION", canCreate: true, canRead: true }]);
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-no-cust",
      status: "PENDING",
      totalDue: 50000,
      organizationId: "org-1",
      customerId: null, // Initial state is null
    });
    (db.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pay-1" });
    (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "tx-no-cust" });

    const custJwt = { sub: "cust-123", organizationId: "org-1", tenantRoleId: "role-cust", branchId: "b1", scope: "CUSTOMER" as any, isCustomer: true };
    const token = await signTestJwt(custJwt);
    
    const res = await app.request("/create-charge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transactionId: "tx-no-cust",
        successRedirectUrl: "https://ok.com/success",
        failureRedirectUrl: "https://ok.com/fail",
      }),
    });

    expect(res.status).toBe(201);
    // Verify that db.transaction.update was called to link the customer
    expect(db.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-no-cust" },
      data: { customerId: "cust-123" },
    });
  });
});

describe("payments saved methods schema", () => {
  it("requires tokenId and last4", () => {
    expect(savePaymentMethodSchema.safeParse({}).success).toBe(false);
    expect(savePaymentMethodSchema.safeParse({ tokenId: "tok", last4: "4242", expiryMonth: 12, expiryYear: 2028 }).success).toBe(true);
  });

  it("rejects invalid last4", () => {
    expect(savePaymentMethodSchema.safeParse({ tokenId: "tok", last4: "12", expiryMonth: 12, expiryYear: 2028 }).success).toBe(false);
  });
});

describe("payments methods HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    db = createMockDb();
    app = mountFeatureWithDb(paymentsApp, db, {
      ...getTestBindings(),
      XENDIT_SECRET_KEY: "xnd_test_key",
      XENDIT_WEBHOOK_TOKEN: "tok",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 for GET /methods without auth", async () => {
    const res = await app.request("/methods", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with user's payment methods", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.savedPaymentMethod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "pm-1", type: "CARD", last4: "4242", expiryMonth: 12, expiryYear: 2028, isDefault: true, createdAt: new Date() },
    ]);

    const res = await app.request("/methods", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { last4: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].last4).toBe("4242");
  });

  it("returns 201 when saving a new payment method", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.savedPaymentMethod.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.savedPaymentMethod.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pm-new",
      type: "CARD",
      last4: "1234",
      expiryMonth: 6,
      expiryYear: 2027,
      isDefault: false,
      createdAt: new Date(),
    });

    const res = await app.request("/methods", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: "tok_123", last4: "1234", expiryMonth: 6, expiryYear: 2027 }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { last4: string } };
    expect(body.data.last4).toBe("1234");
  });

  it("returns 400 when user already has 5 methods", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.savedPaymentMethod.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    const res = await app.request("/methods", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: "tok_123", last4: "1234", expiryMonth: 6, expiryYear: 2027 }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when deleting non-owned payment method", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.savedPaymentMethod.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request("/methods/pm-unknown", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 200 when deleting own payment method", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.savedPaymentMethod.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pm-1",
      userId: testUsers.customer.userId,
    });
    (db.savedPaymentMethod.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pm-1" });

    const res = await app.request("/methods/pm-1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
  });
});

describe("TransactionService.addPayments", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("persists payments via payment.createMany when totals match a PENDING transaction", async () => {
    (db.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-pay-1",
      organizationId: "org-1",
      status: "PENDING",
      totalDue: 100,
    });
    (db.payment.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.transaction.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tx-pay-1",
      organizationId: "org-1",
      branchId: "branch-1",
      status: "COMPLETED",
      queueEntryId: null,
      promoCode: null,
      loyaltyPointsUsed: 0,
      customerId: null,
      items: [],
    });

    await TransactionService.addPayments(db, "tx-pay-1", {
      payments: [{ method: "CARD", amount: 100, reference: "xendit-inv-1" }],
    });

    expect(db.payment.createMany).toHaveBeenCalledWith({
      data: [
        {
          transactionId: "tx-pay-1",
          organizationId: "org-1",
          method: "CARD",
          amount: 100,
          reference: "xendit-inv-1",
        },
      ],
    });
  });
});
