import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import staffApp from "./staff.index";
import {
  createStaffProfileSchema,
  listStaffQuery,
  assignStaffSchema,
  StaffStatusEnum,
} from "./staff.schema";
import { StaffService } from "./staff.service";
import type { AppEnv } from "../../types";
import { createMockDb, withPrismaScopeChain } from "../../test/helpers";
import { invalidatePermissionCache, requireStaff } from "../../middlewares/rbac";

function mountStaffApp(db: ReturnType<typeof createMockDb>) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    const env = (c.env ??= {} as AppEnv["Bindings"]);
    env.JWT_SECRET = process.env.JWT_SECRET!;
    c.set("db", db);
    await next();
  });
  app.route("/staff", staffApp);
  return app;
}

async function staffMgmtToken(
  db: ReturnType<typeof createMockDb>,
  opts: { create?: boolean; update?: boolean; delete?: boolean }
) {
  vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
    {
      featureCode: "STAFF_MANAGEMENT",
      canCreate: !!opts.create,
      canRead: true,
      canUpdate: !!opts.update,
      canDelete: !!opts.delete,
    },
  ] as never);

  return sign(
    {
      sub: "mgr",
      organizationId: "org-1",
      tenantRoleId: "role-staff",
      branchId: "branch-1",
      isCustomer: false,
      scope: "BRANCH",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.JWT_SECRET!
  );
}

describe("staff.schema", () => {
  it("createStaffProfileSchema requires userId", () => {
    expect(createStaffProfileSchema.safeParse({ userId: "" }).success).toBe(false);
    expect(
      createStaffProfileSchema.safeParse({ userId: "u1" }).success
    ).toBe(true);
  });

  it("listStaffQuery coerces page", () => {
    const q = listStaffQuery.parse({ page: "3" });
    expect(q.page).toBe(3);
  });

  it("assignStaffSchema requires branchId", () => {
    expect(assignStaffSchema.safeParse({ branchId: "b1" }).success).toBe(true);
  });

  it("StaffStatusEnum rejects invalid status", () => {
    expect(StaffStatusEnum.safeParse("INVALID").success).toBe(false);
  });
});

describe("StaffService", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("getById returns null when profile missing", async () => {
    vi.mocked(db.staffProfile.findUnique).mockResolvedValue(null);
    expect(await StaffService.getById(db, "user-1")).toBeNull();
  });

  it("assignToBranch throws when profile missing", async () => {
    vi.mocked(db.staffProfile.findUniqueOrThrow).mockRejectedValue(new Error("Not found"));
    await expect(StaffService.assignToBranch(db, "sp1", "b1")).rejects.toThrow();
  });

  it("list returns paginated data shape", async () => {
    vi.mocked(db.staffProfile.count).mockResolvedValue(7);
    vi.mocked(db.staffProfile.findMany).mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ] as never);
    const out = await StaffService.list(db, { page: 2, limit: 3 });
    expect(out.data).toHaveLength(2);
    expect(out.pagination).toEqual({
      page: 2,
      limit: 3,
      total: 7,
      totalPages: 3,
    });
  });
});

describe("staff HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = withPrismaScopeChain(createMockDb());
    invalidatePermissionCache("role-staff");
    vi.clearAllMocks();
  });

  it("GET /staff returns 200 without auth", async () => {
    vi.mocked(db.staffProfile.count).mockResolvedValue(0);
    vi.mocked(db.staffProfile.findMany).mockResolvedValue([]);
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff");
    expect(res.status).toBe(200);
  });

  it("GET /staff/:id returns 404 when not found", async () => {
    vi.mocked(db.staffProfile.findUnique).mockResolvedValue(null);
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff/user-x");
    expect(res.status).toBe(404);
  });

  it("POST /staff returns 401 without token", async () => {
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /staff returns 403 without STAFF_MANAGEMENT create", async () => {
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([]);
    const t = await sign(
      {
        sub: "u",
        organizationId: "org-1",
        tenantRoleId: "role-x",
        branchId: null,
        isCustomer: false,
        scope: "HQ",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET!
    );
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "u1" }),
    });
    expect(res.status).toBe(403);
  });

  it("requireStaff returns 403 when context is customer", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("isCustomer", true);
      await next();
    });
    app.use("*", requireStaff());
    app.get("/probe", (c) => c.json({ ok: true }));
    const res = await app.request("http://test/probe");
    expect(res.status).toBe(403);
  });

  it("PATCH /staff/:id/status returns 200 for non-customer staff", async () => {
    const t = await sign(
      {
        sub: "barber",
        organizationId: "org-1",
        tenantRoleId: "role-barber",
        branchId: "b1",
        isCustomer: false,
        scope: "BRANCH",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET!
    );
    vi.mocked(db.staffProfile.update).mockResolvedValue({
      userId: "barber",
      status: "AVAILABLE",
    } as never);
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff/barber/status", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "AVAILABLE" }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /staff returns 201 with permission", async () => {
    const t = await staffMgmtToken(db, { create: true });
    vi.mocked(db.staffProfile.create).mockResolvedValue({
      id: "sp1",
      userId: "u1",
      user: { id: "u1" },
    } as never);
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "u1" }),
    });
    expect(res.status).toBe(201);
  });

  it("POST /staff returns 400 on invalid body missing userId", async () => {
    const t = await staffMgmtToken(db, { create: true });
    const app = mountStaffApp(db);
    const res = await app.request("http://test/staff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
