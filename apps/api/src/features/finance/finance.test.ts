import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  plSummaryQuery,
  voidDiscountAuditQuery,
  payrollOversightQuery,
  taxSummaryQuery,
} from "./finance.schema";
import { FinanceService } from "./finance.service";
import financeApp from "./finance.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("finance.schema", () => {
  it("plSummaryQuery requires date range", () => {
    expect(plSummaryQuery.safeParse({}).success).toBe(false);
    expect(
      plSummaryQuery.safeParse({ dateFrom: "2025-01-01", dateTo: "2025-01-31" }).success,
    ).toBe(true);
  });

  it("voidDiscountAuditQuery requires branchId", () => {
    expect(
      voidDiscountAuditQuery.safeParse({
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }).success,
    ).toBe(false);
    expect(
      voidDiscountAuditQuery.safeParse({
        branchId: "b1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }).success,
    ).toBe(true);
  });

  it("payrollOversightQuery allows empty object", () => {
    expect(payrollOversightQuery.safeParse({}).success).toBe(true);
  });

  it("taxSummaryQuery requires dates", () => {
    expect(taxSummaryQuery.safeParse({ dateFrom: "a", dateTo: "b" }).success).toBe(true);
    expect(taxSummaryQuery.safeParse({}).success).toBe(false);
  });
});

describe("FinanceService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("getPLSummary aggregates snapshots and zeros when empty", async () => {
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.staffEarning.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { commission: null } });
    (db.payrollPeriod.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { totalPayout: null } });
    (db.transaction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { netAmount: null } });
    const out = await FinanceService.getPLSummary(db, {
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });
    expect(out.revenue.totalRevenue).toBe(0);
    expect(out.costs.totalCosts).toBe(0);
  });

  it("getTaxSummary returns aggregates", async () => {
    (db.transaction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { taxAmount: 11, netAmount: 100 },
      _count: 3,
    });
    const out = await FinanceService.getTaxSummary(db, {
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      branchId: "b1",
    });
    expect(out.totalTax).toBe(11);
    expect(out.transactionCount).toBe(3);
  });

  it("getVoidDiscountAudit loads audit logs including refunds", async () => {
    (db.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const out = await FinanceService.getVoidDiscountAudit(db, {
      branchId: "b1",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });
    expect(out.voids).toEqual([]);
    expect(out.refunds).toEqual([]);
    expect(out.discounts).toEqual([]);
    expect(out.refundTotal).toBe(0);
  });

  it("getVoidDiscountAudit sums refundedAmount from audit details", async () => {
    const refundLog = {
      id: "al-1",
      action: "REFUND_TRANSACTION",
      details: { reason: "defective", refundedAmount: 500 },
      user: { firstName: "A", lastName: "B", tenantRole: { scope: "HQ" } },
    };
    (db.auditLog.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([refundLog])
      .mockResolvedValueOnce([]);
    const out = await FinanceService.getVoidDiscountAudit(db, {
      branchId: "b1",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });
    expect(out.refunds).toHaveLength(1);
    expect(out.refundTotal).toBe(500);
  });

  it("getPLSummary includes refundsTotal from REFUNDED transactions", async () => {
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.staffEarning.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { commission: null } });
    (db.payrollPeriod.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { totalPayout: null } });
    (db.transaction.aggregate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ _sum: { netAmount: 100 } })
      .mockResolvedValueOnce({ _sum: { netAmount: 50 } })
      .mockResolvedValueOnce({ _sum: { discountAmount: 10 } })
      .mockResolvedValueOnce({ _sum: { taxAmount: 20 } });
    const out = await FinanceService.getPLSummary(db, {
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });
    expect(out.voidsTotal).toBe(100);
    expect(out.refundsTotal).toBe(50);
  });
});

describe("finance HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "FINANCE_REPORTS", canRead: true }]);
  });

  it("returns 401 without token for /pl", async () => {
    const app = mountFeatureWithDb(financeApp, db);
    const res = await app.request(
      "http://t/pl?dateFrom=2025-01-01&dateTo=2025-01-31",
      { method: "GET" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without FINANCE_REPORTS read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(financeApp, db);
    const res = await app.request(
      "http://t/pl?dateFrom=2025-01-01&dateTo=2025-01-31",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for BRANCH scope without branchId on /pl", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: "BRANCH",
    });
    const app = mountFeatureWithDb(financeApp, db);
    const res = await app.request(
      "http://t/pl?dateFrom=2025-01-01&dateTo=2025-01-31",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      message: "Branch-scoped users must specify branchId",
    });
  });

  it("returns 200 for /pl when HQ", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: "HQ",
    });
    (db.branchDailySnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.staffEarning.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: {} });
    (db.payrollPeriod.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: {} });
    (db.transaction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: {} });
    const app = mountFeatureWithDb(financeApp, db);
    const res = await app.request(
      "http://t/pl?dateFrom=2025-01-01&dateTo=2025-01-31",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
  });
});
