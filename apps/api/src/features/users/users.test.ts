import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import usersApp from "./users.index";
import { listUsersQuery, updateRoleSchema, assignBranchSchema } from "./users.schema";
import { UsersService } from "./users.service";
import type { AppEnv } from "../../types";
import { createMockDb, withPrismaScopeChain } from "../../test/helpers";
import { invalidatePermissionCache } from "../../middlewares/rbac";

function mountUsersApp(db: ReturnType<typeof createMockDb>) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    const env = (c.env ??= {} as AppEnv["Bindings"]);
    env.JWT_SECRET = process.env.JWT_SECRET!;
    c.set("db", db);
    await next();
  });
  app.route("/users", usersApp);
  return app;
}

async function jwt(
  payload: {
    sub: string;
    organizationId: string;
    tenantRoleId: string;
    branchId?: string;
    scope: "HQ" | "BRANCH" | "CUSTOMER";
    isCustomer?: boolean;
  },
  secret = process.env.JWT_SECRET!
) {
  return sign(
    {
      ...payload,
      branchId: payload.branchId ?? null,
      isCustomer: payload.isCustomer ?? false,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret
  );
}

describe("users.schema", () => {
  it("listUsersQuery defaults page and limit", () => {
    const q = listUsersQuery.parse({});
    expect(q.page).toBe("1");
    expect(q.limit).toBe("20");
  });

  it("updateRoleSchema accepts enum role", () => {
    expect(updateRoleSchema.parse({ role: "MANAGER" }).role).toBe("MANAGER");
  });

  it("assignBranchSchema requires branchId", () => {
    expect(assignBranchSchema.safeParse({}).success).toBe(false);
    expect(assignBranchSchema.safeParse({ branchId: "b1" }).success).toBe(true);
  });
});

describe("UsersService", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("deactivateUser rejects self-deactivation", async () => {
    await expect(
      UsersService.deactivateUser(db, "same", "same")
    ).rejects.toThrow(/own account/i);
  });

  it("getUserById returns null when missing", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const u = await UsersService.getUserById(db, "nope");
    expect(u).toBeNull();
  });

  it("removeBranchAssignment throws when branch mismatch", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      branchId: "b-other",
      organizationId: "o1",
      branch: { id: "b-other", name: "X" },
    } as never);
    await expect(
      UsersService.removeBranchAssignment(db, "u1", "b1", "admin")
    ).rejects.toThrow(/not found/i);
  });
});

describe("users HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  beforeEach(() => {
    db = withPrismaScopeChain(createMockDb());
    invalidatePermissionCache("role-1");
    vi.clearAllMocks();
  });

  async function withUserMgmtRead() {
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
      {
        featureCode: "USER_MANAGEMENT",
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      },
    ] as never);
    return jwt({
      sub: "admin-1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
  }

  async function withUserMgmtUpdate() {
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
      {
        featureCode: "USER_MANAGEMENT",
        canCreate: false,
        canRead: true,
        canUpdate: true,
        canDelete: false,
      },
    ] as never);
    return jwt({
      sub: "admin-1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
  }

  it("GET /users returns 401 without token", async () => {
    const app = mountUsersApp(db);
    const res = await app.request("http://test/users");
    expect(res.status).toBe(401);
  });

  it("GET /users returns 403 without read permission", async () => {
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([]);
    const app = mountUsersApp(db);
    const token = await jwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-x",
      scope: "BRANCH",
    });
    const res = await app.request("http://test/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("GET /users returns 200 with pagination", async () => {
    const token = await withUserMgmtRead();
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    vi.mocked(db.user.count).mockResolvedValue(0);
    const app = mountUsersApp(db);
    const res = await app.request("http://test/users?page=1&limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      pagination: { total: number };
    };
    expect(body.success).toBe(true);
    expect(body.pagination.total).toBe(0);
  });

  it("GET /users/:id returns 404 when not found", async () => {
    const token = await withUserMgmtRead();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const app = mountUsersApp(db);
    const res = await app.request("http://test/users/u-missing", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /users/:id/role returns 404 when user missing", async () => {
    const token = await withUserMgmtUpdate();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const app = mountUsersApp(db);
    const res = await app.request("http://test/users/u1/role", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "CASHIER" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /users/:id/deactivate returns 400 for self", async () => {
    const token = await withUserMgmtUpdate();
    const app = mountUsersApp(db);
    const res = await app.request("http://test/users/admin-1/deactivate", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
  });
});
