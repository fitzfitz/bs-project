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
import { updateConfigBody, CONFIG_DEFAULTS } from "./config.schema";
import { ConfigService } from "./config.service";
import configApp from "./config.index";

describe("config.schema", () => {
  it("requires value string on updateConfigBody", () => {
    expect(updateConfigBody.safeParse({ value: "10" }).success).toBe(true);
    expect(updateConfigBody.safeParse({}).success).toBe(false);
  });

  it("CONFIG_DEFAULTS includes TAX_RATE", () => {
    expect(CONFIG_DEFAULTS.TAX_RATE).toBeDefined();
  });
});

describe("ConfigService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("getAll merges defaults when row missing", async () => {
    (db.platformConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const all = await ConfigService.getAll(db);
    expect(all.TAX_RATE.value).toBe(CONFIG_DEFAULTS.TAX_RATE);
    expect(all.TAX_RATE.updatedBy).toBeNull();
  });

  it("updateValue upserts and writes audit log", async () => {
    (db.platformConfig.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "TAX_RATE",
      value: "11",
      updatedBy: "u1",
    });
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await ConfigService.updateValue(db, "TAX_RATE", "11", "u1", "org-1");

    expect(db.platformConfig.upsert).toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "PlatformConfig",
        }),
      }),
    );
  });
});

describe("config HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = withPrismaScopeChain(createMockDb());
    app = mountFeatureWithDb(configApp, db);
    vi.clearAllMocks();
  });

  it("returns 401 without auth on GET /", async () => {
    const res = await app.request("/", {}, getTestBindings());
    expect(res.status).toBe(401);
  });

  it("returns 403 without ORG_SETTINGS read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-cfg-deny",
      scope: "HQ",
    });
    const res = await app.request("/", { headers: { Authorization: `Bearer ${token}` } }, getTestBindings());
    expect(res.status).toBe(403);
  });

  it("returns 200 on GET when read permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "ORG_SETTINGS", canRead: true }]);
    (db.platformConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-cfg-read",
      scope: "HQ",
    });
    const res = await app.request("/", { headers: { Authorization: `Bearer ${token}` } }, getTestBindings());
    expect(res.status).toBe(200);
  });

  it("returns 403 on PATCH when only read permitted", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "ORG_SETTINGS", canRead: true }]);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-cfg-readonly",
      scope: "HQ",
    });
    const res = await app.request(
      "/TAX_RATE",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "12" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 on PATCH when update permitted", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ORG_SETTINGS", canRead: true, canUpdate: true },
    ]);
    (db.platformConfig.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-cfg-write",
      scope: "HQ",
    });
    const res = await app.request(
      "/TAX_RATE",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "12" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 on PATCH with empty or invalid body", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ORG_SETTINGS", canRead: true, canUpdate: true },
    ]);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-cfg-write",
      scope: "HQ",
    });

    const resEmpty = await app.request(
      "/TAX_RATE",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      getTestBindings(),
    );
    expect(resEmpty.status).toBe(400);

    const resBadType = await app.request(
      "/TAX_RATE",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: 12 }),
      },
      getTestBindings(),
    );
    expect(resBadType.status).toBe(400);
  });

  it("returns 200 on PATCH for unknown key (upsert behavior)", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ORG_SETTINGS", canRead: true, canUpdate: true },
    ]);
    (db.platformConfig.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "CUSTOM_ORG_FLAG",
      value: "1",
      updatedBy: "u1",
    });
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-cfg-write",
      scope: "HQ",
    });
    const res = await app.request(
      "/CUSTOM_ORG_FLAG",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "1" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
    expect(db.platformConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "CUSTOM_ORG_FLAG" },
        create: expect.objectContaining({ key: "CUSTOM_ORG_FLAG", value: "1" }),
      }),
    );
  });
});
