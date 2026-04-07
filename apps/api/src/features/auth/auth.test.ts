import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import authApp from "./auth.index";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  googleAuthSchema,
} from "./auth.schema";
import { AuthService, getPermissionsForRole } from "./auth.service";
import type { AppEnv } from "../../types";
import { createMockDb, withPrismaScopeChain } from "../../test/helpers";
import { invalidatePermissionCache } from "../../middlewares/rbac";

function mountAuthTestApp(db: ReturnType<typeof createMockDb>) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    const env = (c.env ??= {} as AppEnv["Bindings"]);
    env.JWT_SECRET = process.env.JWT_SECRET!;
    c.set("db", db);
    await next();
  });
  app.route("/auth", authApp);
  return app;
}

async function bearerToken(claims: {
  sub: string;
  organizationId: string;
  tenantRoleId: string;
  branchId?: string | null;
  isCustomer: boolean;
  scope: "HQ" | "BRANCH" | "CUSTOMER";
}) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await sign(
    {
      sub: claims.sub,
      organizationId: claims.organizationId,
      tenantRoleId: claims.tenantRoleId,
      branchId: claims.branchId ?? null,
      isCustomer: claims.isCustomer,
      scope: claims.scope,
      exp,
    },
    process.env.JWT_SECRET!
  );
  return token;
}

describe("auth.schema", () => {
  it("registerSchema rejects short password", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com",
      password: "short",
      firstName: "A",
      lastName: "B",
    });
    expect(r.success).toBe(false);
  });

  it("loginSchema requires email", () => {
    const r = loginSchema.safeParse({ email: "not-email", password: "x" });
    expect(r.success).toBe(false);
  });

  it("refreshSchema requires non-empty token", () => {
    expect(refreshSchema.safeParse({ refreshToken: "" }).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: "tok" }).success).toBe(true);
  });

  it("deleteAccountSchema requires literal DELETE", () => {
    expect(deleteAccountSchema.safeParse({ confirm: "NO" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirm: "DELETE" }).success).toBe(true);
  });

  it("forgotPasswordSchema validates email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "bad" }).success).toBe(false);
  });

  it("googleAuthSchema requires idToken", () => {
    expect(googleAuthSchema.safeParse({ idToken: "" }).success).toBe(false);
  });

  it("updateProfileSchema allows empty patch object", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });
});

describe("AuthService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("getPermissionsForRole maps rows to feature codes", async () => {
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
      {
        featureCode: "USER_MANAGEMENT",
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      },
    ] as never);

    const map = await getPermissionsForRole(db, "role-1");
    expect(map.USER_MANAGEMENT?.canRead).toBe(true);
  });

  it("register throws when organization missing", async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(null);
    await expect(
      AuthService.register(db, {
        orgSlug: "missing",
        email: "a@b.com",
        password: "password12",
        firstName: "A",
        lastName: "B",
      })
    ).rejects.toThrow("Organization not found");
  });

  it("register throws when customer role missing", async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
    vi.mocked(db.tenantRole.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      AuthService.register(db, {
        orgSlug: "acme",
        email: "a@b.com",
        password: "password12",
        firstName: "A",
        lastName: "B",
      })
    ).rejects.toThrow("No customer role");
  });

  it("register throws when email exists", async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
    vi.mocked(db.tenantRole.findFirst).mockResolvedValue({
      id: "cust-role",
      name: "Customer",
      scope: "CUSTOMER",
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1" } as never);
    await expect(AuthService.register(db, {
        orgSlug: "acme",
        email: "a@b.com",
        password: "password12",
        firstName: "A",
        lastName: "B",
      })
    ).rejects.toThrow("Email already in use");
  });

  it("register creates user and notification preference with emailOptOut: false", async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
    vi.mocked(db.tenantRole.findFirst).mockResolvedValue({
      id: "cust-role",
      name: "Customer",
      scope: "CUSTOMER",
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      organizationId: "org-1",
      tenantRoleId: "cust-role",
      tenantRole: { id: "cust-role", name: "Customer", scope: "CUSTOMER" },
    } as never);

    await AuthService.register(db, {
      orgSlug: "acme",
      email: "a@b.com",
      password: "password12",
      firstName: "A",
      lastName: "B",
    });

    expect(db.user.create).toHaveBeenCalled();
    expect(db.notificationPreference.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        organizationId: "org-1",
        emailOptOut: false,
      },
    });
  });

  it("login returns null for wrong password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correct-password", 4);
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      passwordHash: hash,
      tenantRole: { id: "r1", name: "X", scope: "BRANCH" },
    } as never);
    const out = await AuthService.login(db, {
      orgSlug: "acme",
      email: "a@b.com",
      password: "wrong-password",
    });
    expect(out).toBeNull();
  });

  it("validateRefreshToken returns null when expired", async () => {
    vi.mocked(db.refreshToken.findUnique).mockResolvedValue({
      id: "rt1",
      expiresAt: new Date(Date.now() - 1000),
      user: { organizationId: "o1", tenantRoleId: "t1", branchId: null, isCustomer: false, tenantRole: null },
    } as never);
    vi.mocked(db.refreshToken.delete).mockResolvedValue({} as never);
    const out = await AuthService.validateRefreshToken(db, "expired");
    expect(out).toBeNull();
    expect(db.refreshToken.delete).toHaveBeenCalled();
  });

  it("forgotPassword returns generic message", async () => {
    const out = await AuthService.forgotPassword(db, "any@x.com");
    expect(out.message).toMatch(/reset/i);
  });

  describe("googleAuth", () => {
    it("throws when GOOGLE_CLIENT_ID is not provided", async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
      await expect(
        AuthService.googleAuth(db, {
          orgSlug: "acme",
          idToken: "header.payload.signature",
        })
      ).rejects.toThrow("Google auth not configured");
    });

    it("throws for malformed token (not 3 segments)", async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
      await expect(
        AuthService.googleAuth(db, {
          orgSlug: "acme",
          idToken: "not-a-jwt",
          googleClientId: "test-client-id",
        })
      ).rejects.toThrow("Invalid Google ID token");
    });

    it("throws for invalid token signature (JWKS verification)", async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
      const fakeToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.invalid-sig";
      await expect(
        AuthService.googleAuth(db, {
          orgSlug: "acme",
          idToken: fakeToken,
          googleClientId: "test-client-id",
        })
      ).rejects.toThrow();
    });
  });
});

describe("auth HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidatePermissionCache("role-admin");
    vi.clearAllMocks();
  });

  it("POST /auth/register returns 400 without org slug", async () => {
    const app = mountAuthTestApp(db);
    const res = await app.request("http://test/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "a@b.com",
        password: "password12",
        firstName: "A",
        lastName: "B",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/slug/i);
  });

  it("POST /auth/login returns 400 for invalid credentials", async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const app = mountAuthTestApp(db);
    const res = await app.request("http://test/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Org-Slug": "acme" },
      body: JSON.stringify({ email: "a@b.com", password: "password12" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /auth/refresh returns 401 for bad token", async () => {
    vi.mocked(db.refreshToken.findUnique).mockResolvedValue(null);
    const app = mountAuthTestApp(db);
    const res = await app.request("http://test/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "nope" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /auth/me returns 401 without Authorization", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    const res = await app.request("http://test/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /auth/me returns 401 when user not found", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const token = await bearerToken({
      sub: "missing",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      isCustomer: false,
      scope: "HQ",
    });
    const res = await app.request("http://test/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("GET /auth/me includes organization currency fields", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "test@x.com",
      firstName: "A",
      lastName: "B",
      phone: null,
      tenantRoleId: "role-1",
      isCustomer: false,
      organizationId: "org-1",
      branchId: null,
      emailOptIn: true,
      staffProfile: null,
      tenantRole: { id: "role-1", name: "Owner", scope: "HQ" },
      organization: { currency: "USD", currencySymbol: "$", locale: "en-US" },
    } as never);
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([]);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      isCustomer: false,
      scope: "HQ",
    });
    const res = await app.request("http://test/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { organization?: { currency: string; currencySymbol: string; locale: string } } };
    expect(body.data.organization).toBeDefined();
    expect(body.data.organization?.currency).toBe("USD");
    expect(body.data.organization?.currencySymbol).toBe("$");
    expect(body.data.organization?.locale).toBe("en-US");
  });

  it("GET /auth/users returns 403 without USER_MANAGEMENT read", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([]);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-noperms",
      isCustomer: false,
      scope: "BRANCH",
    });
    const res = await app.request("http://test/auth/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("GET /auth/users returns 200 when permission granted", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    vi.mocked(db.tenantRolePermission.findMany).mockResolvedValue([
      {
        featureCode: "USER_MANAGEMENT",
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      },
    ] as never);
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-admin",
      isCustomer: false,
      scope: "HQ",
    });
    const res = await app.request("http://test/auth/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("POST /auth/google returns 400 without org slug", async () => {
    const app = mountAuthTestApp(db);
    const res = await app.request("http://test/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "header.payload.signature" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/slug/i);
  });

  it("POST /auth/google returns 400 for invalid token", async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
    const app = mountAuthTestApp(db);
    const res = await app.request("http://test/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Org-Slug": "acme" },
      body: JSON.stringify({ idToken: "invalid.token.here" }),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /auth/me returns 400 without DELETE confirm", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      isCustomer: true,
      scope: "CUSTOMER",
    });
    const res = await app.request("http://test/auth/me", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirm: "NO" }),
    });
    expect(res.status).toBe(400);
  });



  it("PATCH /auth/me/notification-preferences updates emailOptIn and syncs with NotificationPreference", async () => {
    const scoped = withPrismaScopeChain(db);
    const mockUserUpdate = db.user.update as any;
    mockUserUpdate.mockResolvedValue({ emailOptIn: true });
    
    const mockPrefUpsert = db.notificationPreference.upsert as any;
    mockPrefUpsert.mockResolvedValue({ emailOptOut: false });

    const app = mountAuthTestApp(scoped);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      isCustomer: true,
      scope: "CUSTOMER",
    });

    const res = await app.request("http://test/auth/me/notification-preferences", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailOptIn: true }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { emailOptIn: boolean } };
    expect(body.data.emailOptIn).toBe(true);

    // Verify both were called (sync happened)
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: { emailOptIn: true }
    }));
    expect(mockPrefUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1" },
      update: { emailOptOut: false }
    }));
  });

  it("PATCH /auth/me/notification-preferences updates emailOptIn=false and syncs emailOptOut=true", async () => {
    const scoped = withPrismaScopeChain(db);
    const mockUserUpdate = db.user.update as any;
    mockUserUpdate.mockResolvedValue({ emailOptIn: false });
    
    const mockPrefUpsert = db.notificationPreference.upsert as any;
    mockPrefUpsert.mockResolvedValue({ emailOptOut: true });

    const app = mountAuthTestApp(scoped);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      isCustomer: true,
      scope: "CUSTOMER",
    });

    const res = await app.request("http://test/auth/me/notification-preferences", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailOptIn: false }),
    });

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { emailOptIn: false }
    }));
    expect(mockPrefUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { emailOptOut: true }
    }));
  });

  it("PATCH /auth/me/notification-preferences returns 401 without auth", async () => {
    const app = mountAuthTestApp(db);
    const res = await app.request("http://test/auth/me/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOptIn: false }),
    });
    expect(res.status).toBe(401);
  });

  it("PATCH /auth/me/notification-preferences returns 400 for invalid body", async () => {
    const scoped = withPrismaScopeChain(db);
    const app = mountAuthTestApp(scoped);
    const token = await bearerToken({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      isCustomer: true,
      scope: "CUSTOMER",
    });
    const res = await app.request("http://test/auth/me/notification-preferences", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailOptIn: "not-a-boolean" }),
    });
    expect(res.status).toBe(400);
  });
});
