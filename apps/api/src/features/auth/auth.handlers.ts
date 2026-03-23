import { createRoute, z } from "@hono/zod-openapi";
import { registerSchema, loginSchema, refreshSchema, updateProfileSchema, deleteAccountSchema, forgotPasswordSchema, googleAuthSchema } from "./auth.schema";
import { AuthService, getPermissionsForRole } from "./auth.service";
import { createSuccessSchema, ErrorSchema } from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

// ============================================================================
// Route Definitions
// ============================================================================

const AuthResponseSchema = createSuccessSchema(
  z.object({
    user: z.any().optional(), // Should be strictly typed in production
    accessToken: z.string(),
    refreshToken: z.string(),
  })
);

export const registerRoute = createRoute({
  method: "post",
  path: "/register",
  tags: ["Authentication"],
  summary: "Register a new customer account",
  request: {
    body: {
      content: { "application/json": { schema: registerSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "User registered successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Authentication"],
  summary: "Login with email and password",
  request: {
    body: {
      content: { "application/json": { schema: loginSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Login successful",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid credentials",
    },
  },
});

export const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  tags: ["Authentication"],
  summary: "Refresh access token",
  request: {
    body: {
      content: { "application/json": { schema: refreshSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(
            z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
            })
          ),
        },
      },
      description: "Tokens refreshed",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid refresh token",
    },
  },
});

export const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Authentication"],
  summary: "Get current user profile",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
            schema: createSuccessSchema(
            z.object({
              id: z.string(),
              email: z.string(),
              firstName: z.string(),
              lastName: z.string(),
              phone: z.string().nullable().optional(),
              tenantRoleId: z.string(),
              branchId: z.string().nullable().optional(),
              isCustomer: z.boolean(),
              organizationId: z.string(),
              tenantRole: z.object({
                id: z.string(),
                name: z.string(),
                scope: z.string(),
              }).nullable().optional(),
            })
          ),
        },
      },
      description: "Current user profile",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const updateProfileRoute = createRoute({
  method: "patch",
  path: "/me",
  tags: ["Auth"],
  summary: "Update current user profile",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: updateProfileSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: createSuccessSchema(z.any()) } },
      description: "User profile updated successfully",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const forgotPasswordRoute = createRoute({
  method: "post",
  path: "/forgot-password",
  tags: ["Auth"],
  summary: "Request password reset (sends email if account exists)",
  request: {
    body: {
      content: { "application/json": { schema: forgotPasswordSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ message: z.string() })),
        },
      },
      description: "Reset instructions sent if account exists",
    },
  },
});

export const searchUsersRoute = createRoute({
  method: "get",
  path: "/users",
  tags: ["Auth"],
  summary: "Search users by name or email",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      search: z.string().optional(),
      excludeBarbers: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: createSuccessSchema(z.array(z.any())) } },
      description: "List of matching users",
    },
  },
});

export const googleAuthRoute = createRoute({
  method: "post",
  path: "/google",
  tags: ["Authentication"],
  summary: "Login or register with Google OAuth",
  request: {
    body: {
      content: { "application/json": { schema: googleAuthSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Google auth successful",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid token or organization",
    },
  },
});

export const deleteAccountRoute = createRoute({
  method: "delete",
  path: "/me",
  tags: ["Auth"],
  summary: "Delete current user account (anonymize data, deactivate)",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: deleteAccountSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ message: z.string() })),
        },
      },
      description: "Account deleted successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Missing or invalid confirmation",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

// ============================================================================
// Route Handlers
// ============================================================================
import { sign } from "hono/jwt";

export const registerHandler: RouteHandler<typeof registerRoute, AppEnv> = async (c) => {
  const data = c.req.valid("json");
  const orgSlug = data.orgSlug || c.req.header("X-Org-Slug");
  if (!orgSlug) {
    return c.json({ success: false as const, message: "Organization slug is required (body or X-Org-Slug header)" }, 400);
  }
  const user = await AuthService.register(c.var.db, { ...data, orgSlug });

  const expDate = new Date(Date.now() + 15 * 60 * 1000);
  const accessToken = await sign(
    {
      sub: user.id,
      organizationId: user.organizationId,
      tenantRoleId: user.tenantRoleId,
      branchId: null,
      isCustomer: user.isCustomer ?? true,
      scope: "CUSTOMER",
      exp: Math.floor(expDate.getTime() / 1000),
    },
    c.env.JWT_SECRET
  );

  const rt = await AuthService.createRefreshToken(c.var.db, user.id, user.organizationId);

  const permissions = user.tenantRoleId
    ? await getPermissionsForRole(c.var.db, user.tenantRoleId)
    : {};

  return c.json(
    {
      success: true as const,
      data: {
        user: { ...user, permissions },
        accessToken,
        refreshToken: rt.token,
      },
    },
    201
  );
};

export const loginHandler: RouteHandler<typeof loginRoute, AppEnv> = async (c) => {
  const data = c.req.valid("json");
  const orgSlug = data.orgSlug || c.req.header("X-Org-Slug");
  if (!orgSlug) {
    return c.json({ success: false as const, message: "Organization slug is required (body or X-Org-Slug header)" }, 400);
  }
  const user = await AuthService.login(c.var.db, { ...data, orgSlug });

  if (!user) {
    return c.json(
      { success: false as const, message: "Invalid credentials" },
      400
    );
  }

  const expDate = new Date(Date.now() + 15 * 60 * 1000);
  const accessToken = await sign(
    {
      sub: user.id,
      organizationId: user.organizationId,
      tenantRoleId: user.tenantRoleId,
      branchId: user.branchId ?? null,
      isCustomer: user.isCustomer ?? false,
      scope: user.tenantRole?.scope ?? (user.isCustomer ? "CUSTOMER" : "BRANCH"),
      exp: Math.floor(expDate.getTime() / 1000),
    },
    c.env.JWT_SECRET
  );

  const rt = await AuthService.createRefreshToken(c.var.db, user.id, user.organizationId);

  const permissions = user.tenantRoleId
    ? await getPermissionsForRole(c.var.db, user.tenantRoleId)
    : {};

  return c.json(
    {
      success: true as const,
      data: {
        user: { ...user, permissions },
        accessToken,
        refreshToken: rt.token,
      },
    },
    200
  );
};

export const refreshHandler: RouteHandler<typeof refreshRoute, AppEnv> = async (c) => {
  const data = c.req.valid("json");
  const rtData = await AuthService.validateRefreshToken(c.var.db, data.refreshToken);

  if (!rtData) {
    return c.json(
      { success: false as const, message: "Invalid or expired refresh token" },
      401
    );
  }

  const expDate = new Date(Date.now() + 15 * 60 * 1000);
  const accessToken = await sign(
    {
      sub: rtData.userId,
      organizationId: rtData.user.organizationId,
      tenantRoleId: rtData.user.tenantRoleId,
      branchId: rtData.user.branchId ?? null,
      isCustomer: rtData.user.isCustomer ?? false,
      scope: rtData.user.tenantRole?.scope ?? (rtData.user.isCustomer ? "CUSTOMER" : "BRANCH"),
      exp: Math.floor(expDate.getTime() / 1000),
    },
    c.env.JWT_SECRET
  );

  // Rotate the refresh token
  await AuthService.revokeRefreshToken(c.var.db, data.refreshToken);
  const newRt = await AuthService.createRefreshToken(c.var.db, rtData.userId, rtData.user.organizationId);

  return c.json(
    {
      success: true as const,
      data: {
        accessToken,
        refreshToken: newRt.token,
      },
    },
    200
  );
};

export const meHandler: RouteHandler<typeof meRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ success: false as const, message: "Unauthorized" }, 401);
  }

  const user = await AuthService.getUserById(c.var.db, userId as string);

  if (!user) {
    return c.json({ success: false as const, message: "User not found" }, 401);
  }

  return c.json(
    {
      success: true as const,
      data: user,
    },
    200
  );
};

export const updateProfileHandler: RouteHandler<typeof updateProfileRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");
  
  if (!userId) {
    return c.json({ success: false as const, message: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  const updatedUser = await AuthService.updateUserProfile(c.var.db, userId as string, data);

  return c.json(
    {
      success: true as const,
      data: updatedUser,
    },
    200
  );
};

export const forgotPasswordHandler: RouteHandler<typeof forgotPasswordRoute, AppEnv> = async (c) => {
  const body = c.req.valid("json");
  const result = await AuthService.forgotPassword(c.var.db, body.email);
  return c.json(
    {
      success: true as const,
      data: result,
    },
    200
  );
};

export const deleteAccountHandler: RouteHandler<typeof deleteAccountRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");
  const tenantRoleId = c.get("tenantRoleId");
  
  if (!userId) {
    return c.json({ success: false as const, message: "Unauthorized" }, 401);
  }

  const body = c.req.valid("json");
  if (body.confirm !== "DELETE") {
    return c.json(
      { success: false as const, message: "Must send { confirm: \"DELETE\" } to confirm account deletion" },
      400
    );
  }

  await AuthService.deleteAccount(c.var.db, userId as string, tenantRoleId ?? null);

  return c.json(
    {
      success: true as const,
      data: { message: "Account deleted successfully" },
    },
    200
  );
};

export const searchUsersHandler: RouteHandler<typeof searchUsersRoute, AppEnv> = async (c) => {
  const { search, excludeBarbers } = c.req.valid("query");
  const users = await AuthService.searchUsers(c.var.db, search ?? "", excludeBarbers === "true");
  return c.json({ success: true as const, data: users }, 200);
};

function buildJwtPayload(user: { id: string; organizationId: string; tenantRoleId: string; branchId?: string | null; isCustomer: boolean; tenantRole?: { scope: string } | null }, expDate: Date) {
  return {
    sub: user.id,
    organizationId: user.organizationId,
    tenantRoleId: user.tenantRoleId,
    branchId: user.branchId ?? null,
    isCustomer: user.isCustomer ?? false,
    scope: user.tenantRole?.scope ?? (user.isCustomer ? "CUSTOMER" : "BRANCH"),
    exp: Math.floor(expDate.getTime() / 1000),
  };
}

export const googleAuthHandler: RouteHandler<typeof googleAuthRoute, AppEnv> = async (c) => {
  const data = c.req.valid("json");
  const orgSlug = data.orgSlug || c.req.header("X-Org-Slug");
  if (!orgSlug) {
    return c.json({ success: false as const, message: "Organization slug is required (body or X-Org-Slug header)" }, 400);
  }

  try {
    const user = await AuthService.googleAuth(c.var.db, { ...data, orgSlug });

    const expDate = new Date(Date.now() + 15 * 60 * 1000);
    const accessToken = await sign(
      buildJwtPayload(user, expDate),
      c.env.JWT_SECRET
    );

    const rt = await AuthService.createRefreshToken(c.var.db, user.id, user.organizationId);

    const permissions = user.tenantRoleId
      ? await getPermissionsForRole(c.var.db, user.tenantRoleId)
      : {};

    return c.json(
      {
        success: true as const,
        data: {
          user: { ...user, permissions },
          accessToken,
          refreshToken: rt.token,
        },
      },
      200
    );
  } catch (err: any) {
    return c.json(
      { success: false as const, message: err.message || "Google auth failed" },
      400
    );
  }
};
