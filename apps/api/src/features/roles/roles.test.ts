import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockDb,
  mountFeatureWithDb,
  withPrismaScopeChain,
  signTestJwt,
  mockTenantRolePermissions,
  getTestBindings,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";
import {
  createRoleSchema,
  updateRoleSchema,
  permissionMatrixSchema,
  roleServicesSchema,
} from "./roles.schema";
import { RolesService } from "./roles.service";
import rolesApp from "./roles.index";

describe("roles.schema", () => {
  it("createRoleSchema enforces name length", () => {
    expect(createRoleSchema.safeParse({ name: "", scope: "HQ" }).success).toBe(false);
    expect(
      createRoleSchema.safeParse({ name: "Supervisor", scope: "BRANCH" }).success,
    ).toBe(true);
  });

  it("updateRoleSchema allows partial", () => {
    expect(updateRoleSchema.safeParse({ name: "X" }).success).toBe(true);
  });

  it("permissionMatrixSchema accepts array", () => {
    const m = permissionMatrixSchema.parse([
      {
        featureCode: "USERS",
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      },
    ]);
    expect(m).toHaveLength(1);
  });

  it("roleServicesSchema", () => {
    expect(roleServicesSchema.parse({ serviceIds: ["s1"] }).serviceIds).toEqual(["s1"]);
  });
});

describe("RolesService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("createRole inserts with organizationId", async () => {
    (db.tenantRole.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "r1" });

    await RolesService.createRole(db, "org-1", {
      name: "Custom",
      scope: "BRANCH",
      isServiceProvider: false,
    });

    expect(db.tenantRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "org-1", name: "Custom" }),
      }),
    );
  });

  it("updateRole throws when missing", async () => {
    (db.tenantRole.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(RolesService.updateRole(db, "missing", { name: "x" })).rejects.toThrow(
      "Role not found",
    );
  });

  it("deleteRole throws for system role", async () => {
    (db.tenantRole.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r1",
      isSystemRole: true,
      _count: { users: 0 },
    });
    await expect(RolesService.deleteRole(db, "r1")).rejects.toThrow("system role");
  });

  it("deleteRole throws when users assigned", async () => {
    (db.tenantRole.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r1",
      isSystemRole: false,
      _count: { users: 2 },
    });
    await expect(RolesService.deleteRole(db, "r1")).rejects.toThrow("assigned users");
  });

  it("setPermissionMatrix replaces rows", async () => {
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db),
    );
    (db.tenantRolePermission.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.tenantRolePermission.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.tenantRolePermission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await RolesService.setPermissionMatrix(db, "role-1", [
      {
        featureCode: "USERS",
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      },
    ]);

    expect(db.tenantRolePermission.deleteMany).toHaveBeenCalled();
    expect(db.tenantRolePermission.create).toHaveBeenCalled();
  });
});

describe("roles HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = withPrismaScopeChain(createMockDb());
    app = mountFeatureWithDb(rolesApp, db);
    vi.clearAllMocks();
  });

  it("returns 401 without token", async () => {
    const res = await app.request("/", {}, getTestBindings());
    expect(res.status).toBe(401);
  });

  it("returns 403 without ROLE_MANAGEMENT read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-deny",
      scope: "HQ",
    });
    const res = await app.request("/", { headers: { Authorization: `Bearer ${token}` } }, getTestBindings());
    expect(res.status).toBe(403);
  });

  it("returns 200 list when read permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "ROLE_MANAGEMENT", canRead: true }]);
    (db.tenantRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-ok",
      scope: "HQ",
    });
    const res = await app.request("/", { headers: { Authorization: `Bearer ${token}` } }, getTestBindings());
    expect(res.status).toBe(200);
  });

  it("returns 403 for POST without create permission", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "ROLE_MANAGEMENT", canRead: true }]);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-no-create",
      scope: "HQ",
    });
    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "R", scope: "HQ" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for PATCH without update permission", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "ROLE_MANAGEMENT", canRead: true }]);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-no-update",
      scope: "HQ",
    });
    const res = await app.request(
      "/some-id",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "X" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 201 on POST with valid createRoleSchema body", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ROLE_MANAGEMENT", canRead: true, canCreate: true },
    ]);
    (db.tenantRole.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r-new",
      name: "Floor Lead",
      scope: "BRANCH",
      isServiceProvider: false,
    });
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-create-ok",
      scope: "HQ",
    });
    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Floor Lead",
          scope: "BRANCH",
          isServiceProvider: false,
        }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("r-new");
  });

  it("returns 400 on PATCH when role id is unknown", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ROLE_MANAGEMENT", canRead: true, canCreate: true, canUpdate: true },
    ]);
    (db.tenantRole.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-patch-ok",
      scope: "HQ",
    });
    const res = await app.request(
      "/unknown-role-id",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Renamed" }),
      },
      getTestBindings(),
    );
    const patchBody = (await res.json()) as { success: boolean; message?: string };
    expect(res.status).toBe(400);
    expect(patchBody.success).toBe(false);
    expect(patchBody.message).toMatch(/not found/i);
  });

  it("returns 400 on DELETE for system role", async () => {
    mockTenantRolePermissions(db, [
      {
        featureCode: "ROLE_MANAGEMENT",
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    ]);
    (db.tenantRole.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r-sys",
      isSystemRole: true,
      _count: { users: 0 },
    });
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-delete-ok",
      scope: "HQ",
    });
    const res = await app.request("/r-sys", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, getTestBindings());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/system role/i);
  });
});
