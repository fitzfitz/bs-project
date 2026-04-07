import { describe, it, expect, vi, beforeEach } from "vitest";
import { sign } from "hono/jwt";
import bcrypt from "bcryptjs";
import { createMockDb, mountFeatureWithDb, getTestBindings } from "../../test/helpers";
import {
  platformLoginSchema,
  createOrgSchema,
  updateOrgSchema,
  platformConfigSchema,
} from "./platform.schema";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";
import { ConfigService } from "../config/config.service";
import { PlatformService } from "./platform.service";
import platformApp from "./platform.index";

vi.mock("../../middlewares/rbac", () => ({
  invalidateAllPermissionCaches: vi.fn(),
}));

describe("platform.schema", () => {
  it("platformLoginSchema requires email", () => {
    expect(platformLoginSchema.safeParse({ password: "x" }).success).toBe(false);
    expect(
      platformLoginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("createOrgSchema validates slug pattern", () => {
    expect(
      createOrgSchema.safeParse({
        name: "O",
        slug: "Bad_Slug",
        industry: "BARBERSHOP",
        ownerEmail: "o@o.com",
        ownerFirstName: "A",
        ownerLastName: "B",
        ownerPassword: "12345678",
      }).success,
    ).toBe(false);
    expect(
      createOrgSchema.safeParse({
        name: "O",
        slug: "good-slug",
        industry: "BARBERSHOP",
        ownerEmail: "o@o.com",
        ownerFirstName: "A",
        ownerLastName: "B",
        ownerPassword: "12345678",
      }).success,
    ).toBe(true);
  });

  it("updateOrgSchema partial", () => {
    expect(updateOrgSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("platformConfigSchema", () => {
    expect(platformConfigSchema.safeParse({ key: "k", value: "v" }).success).toBe(true);
  });
});

describe("PlatformService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    ConfigService.clearCache();
    vi.mocked(db.feature.findMany).mockResolvedValue([] as never);
    vi.mocked(db.tenantRole.create).mockResolvedValue({ id: "role-hq", scope: "HQ" } as never);
  });

  it("loginAdmin returns null when user missing", async () => {
    (db.platformAdmin.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(PlatformService.loginAdmin(db, "x@y.com", "pw")).resolves.toBeNull();
  });

  it("loginAdmin returns null when password wrong", async () => {
    (db.platformAdmin.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
      email: "x@y.com",
      passwordHash: "hash",
    });
    vi.spyOn(bcrypt, "compare").mockResolvedValue(false as never);
    await expect(PlatformService.loginAdmin(db, "x@y.com", "pw")).resolves.toBeNull();
    vi.restoreAllMocks();
  });

  it("createOrganization throws on duplicate slug", async () => {
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "exists" });
    await expect(
      PlatformService.createOrganization(db, {
        name: "N",
        slug: "dup",
        industry: "BARBERSHOP",
        ownerEmail: "o@o.com",
        ownerFirstName: "A",
        ownerLastName: "B",
        ownerPassword: "12345678",
      }),
    ).rejects.toThrow("slug already in use");
  });

  it("getOrganizationById returns null when missing", async () => {
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(PlatformService.getOrganizationById(db, "missing")).resolves.toBeNull();
  });

  it("createOrganization sets owner emailOptOut: false by default", async () => {
    (db.tenantRole.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "role-hq", scope: "HQ" });
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.organization.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "org-1" });
    (db.industryTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.tenantRole.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 4 });
    (db.tenantRole.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "role-owner", name: "Owner", scope: "HQ" });
    (db.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      id: "user-owner",
      email: "owner@org.com",
      tenantRole: { id: "role-owner", name: "Owner", scope: "HQ" }
    });
    (db.notificationPreference.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => fn(db));
    
    await PlatformService.createOrganization(db, {
      name: "New Org",
      slug: "new-org",
      industry: "BARBERSHOP",
      ownerEmail: "owner@org.com",
      ownerFirstName: "John",
      ownerLastName: "Doe",
      ownerPassword: "password123",
    });

    expect(db.notificationPreference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-owner",
          emailOptOut: false,
        }),
      }),
    );
  });
});

describe("platform HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    db = createMockDb();
    app = mountFeatureWithDb(platformApp, db);
    vi.clearAllMocks();
  });

  async function platformToken() {
    return sign(
      {
        sub: "admin-1",
        platformAdmin: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET!,
      "HS256",
    );
  }

  it("returns 401 for login when admin missing", async () => {
    (db.platformAdmin.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nope@x.com", password: "secret" }),
      },
      getTestBindings(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for protected route without token", async () => {
    const res = await app.request("/organizations", {}, getTestBindings());
    expect(res.status).toBe(401);
  });

  it("returns 403 when bearer is tenant JWT not platform admin", async () => {
    const tenantTok = await sign(
      {
        sub: "u1",
        organizationId: "org-1",
        tenantRoleId: "r1",
        scope: "HQ",
        isCustomer: false,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET!,
      "HS256",
    );

    const res = await app.request(
      "/organizations",
      { headers: { Authorization: `Bearer ${tenantTok}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 list organizations for platform admin", async () => {
    (db.organization.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await app.request(
      "/organizations",
      { headers: { Authorization: `Bearer ${await platformToken()}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown organization", async () => {
    (db.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request(
      "/organizations/missing-id",
      { headers: { Authorization: `Bearer ${await platformToken()}` } },
      getTestBindings(),
    );
    expect(res.status).toBe(404);
  });
});
