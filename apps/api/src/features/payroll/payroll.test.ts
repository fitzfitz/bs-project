import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generatePeriodSchema,
  listPayrollQuerySchema,
  disputeSchema,
  bulkApproveSchema,
  bulkDisburseSchema,
} from "./payroll.schema";
import { PayrollService } from "./payroll.service";
import payrollApp from "./payroll.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("payroll.schema", () => {
  it("generatePeriod validates ISO dates", () => {
    expect(
      generatePeriodSchema.safeParse({
        staffProfileId: "s1",
        periodStart: "bad",
        periodEnd: "2025-01-31",
      }).success,
    ).toBe(false);
    expect(
      generatePeriodSchema.safeParse({
        staffProfileId: "s1",
        periodStart: "2025-01-01",
        periodEnd: "2025-01-31",
      }).success,
    ).toBe(true);
  });

  it("disputeSchema requires non-empty note", () => {
    expect(disputeSchema.safeParse({ note: "" }).success).toBe(false);
    expect(disputeSchema.safeParse({ note: "wrong amount" }).success).toBe(true);
  });

  it("listPayrollQuerySchema defaults", () => {
    const q = listPayrollQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
  });
});

describe("PayrollService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("generatePeriod throws when staff profile not found", async () => {
    (db.staffEarning.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      PayrollService.generatePeriod(db, {
        staffProfileId: "missing",
        periodStart: "2025-01-01",
        periodEnd: "2025-01-07",
      }),
    ).rejects.toThrow("Staff profile not found");
  });

  it("transition rejects invalid status change", async () => {
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
      status: "DRAFT",
    });
    await expect(
      PayrollService.transition(db, "p1", "DISBURSED", {}),
    ).rejects.toThrow("Invalid transition");
  });

  it("assertBarberOwnsPayroll throws when no matching staff", async () => {
    (db.staffProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      PayrollService.assertBarberOwnsPayroll(db, "sp1", "u1"),
    ).rejects.toThrow("does not belong");
  });
});

describe("payroll HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "PAYROLL", canRead: true, canCreate: true, canUpdate: true },
    ]);
  });

  it("returns 401 without token for list", async () => {
    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 403 without PAYROLL read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.cashier.userId,
      organizationId: testUsers.cashier.organizationId,
      tenantRoleId: testUsers.cashier.tenantRoleId,
      branchId: testUsers.cashier.branchId,
      scope: testUsers.cashier.scope,
    });
    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown payroll id", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/nope", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when submit invalid transition", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pp1",
      status: "DISBURSED",
    });
    (db.payrollPeriod.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/pp1/submit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
  });

  // ─── Bulk Approve ──────────────────────────────────────────────────────────

  it("bulk-approve returns 200 and approves all valid periods", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    const periods = [
      { id: "pp1", status: "PENDING_APPROVAL", organizationId: "org-1" },
      { id: "pp2", status: "PENDING_APPROVAL", organizationId: "org-1" },
    ];
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(periods[0])
      .mockResolvedValueOnce(periods[1]);
    (db.payrollPeriod.update as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where }: { where: { id: string } }) => Promise.resolve({ ...periods.find((p) => p.id === where.id), status: "APPROVED" }),
    );
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "al-1" });

    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/bulk-approve", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["pp1", "pp2"], note: "Batch approved" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { approved: number } };
    expect(body.success).toBe(true);
    expect(body.data.approved).toBe(2);
  });

  it("bulk-approve returns 400 when any period has wrong status", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: "pp1", status: "PENDING_APPROVAL" })
      .mockResolvedValueOnce({ id: "pp2", status: "DRAFT" });

    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/bulk-approve", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["pp1", "pp2"] }),
    });
    expect(res.status).toBe(400);
  });

  it("bulk-approve returns 400 when period not found", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/bulk-approve", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["nope"] }),
    });
    expect(res.status).toBe(400);
  });

  it("bulk-approve returns 401 without auth", async () => {
    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["pp1"] }),
    });
    expect(res.status).toBe(401);
  });

  // ─── Bulk Disburse ─────────────────────────────────────────────────────────

  it("bulk-disburse returns 200 and disburses all valid periods", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: "pp1", status: "APPROVED", organizationId: "org-1" })
      .mockResolvedValueOnce({ id: "pp2", status: "APPROVED", organizationId: "org-1" });
    (db.payrollPeriod.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pp1", status: "DISBURSED" });
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "al-1" });

    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/bulk-disburse", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["pp1", "pp2"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { disbursed: number } };
    expect(body.success).toBe(true);
    expect(body.data.disbursed).toBe(2);
  });

  it("bulk-disburse returns 400 when any period has wrong status", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: "pp1", status: "APPROVED" })
      .mockResolvedValueOnce({ id: "pp2", status: "PENDING_APPROVAL" });

    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/bulk-disburse", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["pp1", "pp2"] }),
    });
    expect(res.status).toBe(400);
  });

  // ─── Bulk schemas ──────────────────────────────────────────────────────────

  it("returns 403 when disputing payroll that is not owned", async () => {
    const token = await signTestJwt({
      sub: testUsers.barber.userId,
      organizationId: testUsers.barber.organizationId,
      tenantRoleId: testUsers.barber.tenantRoleId,
      branchId: testUsers.barber.branchId,
      scope: testUsers.barber.scope,
    });
    (db.payrollPeriod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pp1",
      staffProfileId: "other-sp",
      status: "PENDING_APPROVAL",
    });
    (db.staffProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(payrollApp, db);
    const res = await app.request("http://t/pp1/dispute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ note: "not my payroll" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("bulk payroll schemas", () => {
  it("bulkApproveSchema requires non-empty ids array", () => {
    expect(bulkApproveSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkApproveSchema.safeParse({}).success).toBe(false);
    expect(bulkApproveSchema.safeParse({ ids: ["pp1"] }).success).toBe(true);
    expect(bulkApproveSchema.safeParse({ ids: ["pp1"], note: "ok" }).success).toBe(true);
  });

  it("bulkApproveSchema rejects more than 50 ids", () => {
    const ids = Array.from({ length: 51 }, (_, i) => `pp-${i}`);
    expect(bulkApproveSchema.safeParse({ ids }).success).toBe(false);
  });

  it("bulkDisburseSchema requires non-empty ids array", () => {
    expect(bulkDisburseSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkDisburseSchema.safeParse({ ids: ["pp1"] }).success).toBe(true);
  });
});
