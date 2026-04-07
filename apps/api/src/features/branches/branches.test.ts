import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import branchesApp from "./branches.index";
import {
  createBranchSchema,
  operatingHourSchema,
  createSurgeRuleSchema,
  createBranchHolidaySchema,
  listBranchesQuery,
} from "./branches.schema";
import { BranchesService } from "./branches.service";
import type { AppEnv } from "../../types";
import type { NotificationService } from "../../utils/notifications";
import { createMockDb, withPrismaScopeChain } from "../../test/helpers";
import { invalidatePermissionCache } from "../../middlewares/rbac";

function mountBranchesApp(db: ReturnType<typeof createMockDb>) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    const env = (c.env ??= {} as AppEnv["Bindings"]);
    env.JWT_SECRET = process.env.JWT_SECRET!;
    c.set("db", db);
    await next();
  });
  app.route("/branches", branchesApp);
  return app;
}

async function tokenWithBranchPerms(
  db: ReturnType<typeof createMockDb>,
  action: "create" | "update" | "delete",
  flags: Partial<Record<"canCreate" | "canRead" | "canUpdate" | "canDelete", boolean>> = {}
) {
  const base = {
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    ...flags,
  };
  if (action === "create") base.canCreate = true;
  if (action === "update") base.canUpdate = true;
  if (action === "delete") base.canDelete = true;

  vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
    { featureCode: "BRANCH_MANAGEMENT", ...base },
  ] as never);

  return sign(
    {
      sub: "admin",
      organizationId: "org-1",
      tenantRoleId: "role-b",
      branchId: null,
      isCustomer: false,
      scope: "HQ",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.JWT_SECRET!
  );
}

describe("branches.schema", () => {
  it("createBranchSchema requires name, address, city", () => {
    expect(createBranchSchema.safeParse({ name: "", address: "a", city: "c" }).success).toBe(
      false
    );
    expect(
      createBranchSchema.safeParse({
        name: "Main",
        address: "1 St",
        city: "Jakarta",
      }).success
    ).toBe(true);
  });

  it("operatingHourSchema validates time format", () => {
    expect(
      operatingHourSchema.safeParse({
        day: "MONDAY",
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: false,
      }).success
    ).toBe(true);
    expect(
      operatingHourSchema.safeParse({
        day: "MONDAY",
        openTime: "25:00",
        closeTime: "17:00",
      }).success
    ).toBe(false);
  });

  it("createSurgeRuleSchema requires positive multiplier and days", () => {
    expect(
      createSurgeRuleSchema.safeParse({
        name: "Peak",
        days: ["SATURDAY"],
        startHour: 10,
        endHour: 12,
        multiplier: 1.5,
      }).success
    ).toBe(true);
    expect(
      createSurgeRuleSchema.safeParse({
        name: "Bad",
        days: [],
        startHour: 0,
        endHour: 1,
        multiplier: -1,
      }).success
    ).toBe(false);
  });

  it("createBranchHolidaySchema validates date", () => {
    expect(createBranchHolidaySchema.safeParse({ date: "2025-12-25", name: "X" }).success).toBe(
      true
    );
    expect(createBranchHolidaySchema.safeParse({ date: "25-12-2025", name: "X" }).success).toBe(
      false
    );
  });

  it("listBranchesQuery transforms isActive string", () => {
    const q = listBranchesQuery.parse({ isActive: "true" });
    expect(q.isActive).toBe(true);
  });
});

describe("BranchesService", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("getById returns null when branch missing", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue(null);
    expect(await BranchesService.getById(db, "b1")).toBeNull();
  });

  it("toggleActive updates branch", async () => {
    vi.mocked(db.branch.update).mockResolvedValue({ id: "b1", isActive: false } as never);
    const out = await BranchesService.toggleActive(db, "b1", false);
    expect(out.isActive).toBe(false);
  });
});

describe("branches HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = withPrismaScopeChain(createMockDb());
    invalidatePermissionCache("role-b");
    vi.clearAllMocks();
  });

  it("GET /branches returns 200 without auth", async () => {
    vi.mocked(db.branch.findMany).mockResolvedValue([]);
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches");
    expect(res.status).toBe(200);
  });

  it("GET /branches/:id returns 404 when missing", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue(null);
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches/b-missing");
    expect(res.status).toBe(404);
  });

  it("POST /branches returns 401 without token", async () => {
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "N",
        address: "A",
        city: "C",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /branches returns 403 without create permission", async () => {
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([]);
    const t = await sign(
      {
        sub: "u",
        organizationId: "org-1",
        tenantRoleId: "role-b",
        branchId: null,
        isCustomer: false,
        scope: "HQ",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET!
    );
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "N", address: "A", city: "C" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /branches returns 201 when allowed", async () => {
    const t = await tokenWithBranchPerms(db, "create");
    vi.mocked(db.branch.create).mockResolvedValue({
      id: "b-new",
      organizationId: "org-1",
      name: "N",
    } as never);
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "N", address: "A", city: "C" }),
    });
    expect(res.status).toBe(201);
  });

  it("POST /branches returns 400 when create body omits required name", async () => {
    const t = await tokenWithBranchPerms(db, "create");
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: "A", city: "C" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /branches/:id returns 200 when branch exists", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue({
      id: "b-existing",
      organizationId: "org-1",
      name: "Main",
      address: "1 St",
      city: "Jakarta",
    } as never);
    const app = mountBranchesApp(db);
    const res = await app.request("http://test/branches/b-existing");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { id: string; name: string } };
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: "b-existing", name: "Main" });
  });
});

describe("BranchesService.emergencyClose push notifications", () => {
  let db: ReturnType<typeof createMockDb>;
  let mockNs: NotificationService;

  beforeEach(() => {
    db = createMockDb();
    mockNs = { sendPush: vi.fn().mockResolvedValue(true), sendWhatsApp: vi.fn().mockResolvedValue(false), sendSms: vi.fn().mockResolvedValue(false), sendEmail: vi.fn().mockResolvedValue(false) };
    vi.clearAllMocks();
  });

  it("sends push notification to affected queue customers on emergency close", async () => {
    vi.mocked(db.branch.update).mockResolvedValue({
      id: "b1", name: "Main Branch", isEmergencyClosed: true, organizationId: "org-1", isActive: true,
    } as never);
    vi.mocked(db.queueEntry.findMany).mockResolvedValue([
      { customerId: "cust-1" },
      { customerId: "cust-2" },
    ] as never);
    vi.mocked(db.queueEntry.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { customerId: "cust-1" },
    ] as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(db.notification.create).mockResolvedValue({} as never);

    const result = await BranchesService.emergencyClose(
      db, "b1", "org-1", "admin-1", undefined, mockNs
    );

    expect(result.queueCancelled).toBe(2);
    expect(result.bookingsCancelled).toBe(1);
    expect(result.affectedUserIds).toHaveLength(2);
    expect(result.affectedUserIds).toContain("cust-1");
    expect(result.affectedUserIds).toContain("cust-2");
    expect(mockNs.sendPush).toHaveBeenCalledTimes(2);
    expect(mockNs.sendPush).toHaveBeenCalledWith(
      "cust-1", "Branch Emergency Closure",
      expect.stringContaining("Main Branch"),
      expect.objectContaining({ branchId: "b1", type: "EMERGENCY_CLOSURE" })
    );
  });

  it("does not send notifications when there are no affected customers", async () => {
    vi.mocked(db.branch.update).mockResolvedValue({
      id: "b1", name: "Main", isEmergencyClosed: true, organizationId: "org-1", isActive: true,
    } as never);
    vi.mocked(db.queueEntry.findMany).mockResolvedValue([] as never);
    vi.mocked(db.queueEntry.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(db.booking.findMany).mockResolvedValue([] as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);

    await BranchesService.emergencyClose(
      db, "b1", "org-1", "admin-1", undefined, mockNs
    );

    expect(mockNs.sendPush).not.toHaveBeenCalled();
  });

  it("deduplicates customers who appear in both queue and bookings", async () => {
    vi.mocked(db.branch.update).mockResolvedValue({
      id: "b1", name: "Test", isEmergencyClosed: true, organizationId: "org-1", isActive: true,
    } as never);
    vi.mocked(db.queueEntry.findMany).mockResolvedValue([
      { customerId: "cust-1" },
    ] as never);
    vi.mocked(db.queueEntry.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { customerId: "cust-1" },
    ] as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(db.notification.create).mockResolvedValue({} as never);

    const result = await BranchesService.emergencyClose(
      db, "b1", "org-1", "admin-1", undefined, mockNs
    );

    expect(result.affectedUserIds).toHaveLength(1);
    expect(mockNs.sendPush).toHaveBeenCalledTimes(1);
  });
});
