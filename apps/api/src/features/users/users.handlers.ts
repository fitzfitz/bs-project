import { createRoute, z } from "@hono/zod-openapi";
import {
  listUsersQuery,
  updateRoleSchema,
  assignBranchSchema,
} from "./users.schema";
import { UsersService } from "./users.service";
import {
  createSuccessSchema,
  createPaginatedSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable().optional(),
  tenantRoleId: z.string(),
  tenantRole: z.object({ name: z.string(), scope: z.string() }).optional(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
});

// ── Route definitions ──────────────────────────────────────────────

export const listUsersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["User Management"],
  summary: "List users with filters",
  security: [{ bearerAuth: [] }],
  request: { query: listUsersQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(UserSchema),
        },
      },
      description: "Paginated user list",
    },
  },
});

export const getUserRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["User Management"],
  summary: "Get user details",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(z.any()) },
      },
      description: "User details",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

export const updateRoleRoute = createRoute({
  method: "patch",
  path: "/{id}/role",
  tags: ["User Management"],
  summary: "Update user role",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateRoleSchema } } },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(UserSchema) },
      },
      description: "Role updated",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid role or constraint error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

export const assignBranchRoute = createRoute({
  method: "post",
  path: "/{id}/assign-branch",
  tags: ["User Management"],
  summary: "Assign user to a branch",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: assignBranchSchema } } },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(z.any()) },
      },
      description: "Branch assigned",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid request",
    },
  },
});

export const removeBranchRoute = createRoute({
  method: "delete",
  path: "/{id}/assign-branch/{branchId}",
  tags: ["User Management"],
  summary: "Remove user from a branch",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), branchId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ removed: z.boolean() })),
        },
      },
      description: "Assignment removed",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Assignment not found",
    },
  },
});

export const deactivateUserRoute = createRoute({
  method: "patch",
  path: "/{id}/deactivate",
  tags: ["User Management"],
  summary: "Deactivate a user account",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(UserSchema) },
      },
      description: "User deactivated",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Cannot deactivate",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

export const reactivateUserRoute = createRoute({
  method: "patch",
  path: "/{id}/reactivate",
  tags: ["User Management"],
  summary: "Reactivate a deactivated user",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(UserSchema) },
      },
      description: "User reactivated",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

// ── Handlers ────────────────────────────────────────────────────────

export const listUsersHandler: RouteHandler<
  typeof listUsersRoute,
  AppEnv
> = async (c) => {
  const query = c.req.valid("query");
  const callerRole = c.get("scope") as string;
  const callerBranchId = c.get("branchId");
  const organizationId = c.get("organizationId");

  const result = await UsersService.listUsers(c.var.db, {
    ...query,
    page: parseInt(query.page ?? "1", 10),
    limit: parseInt(query.limit ?? "20", 10),
    callerRole: callerRole ?? "",
    callerBranchId,
    organizationId: organizationId ?? undefined,
  });

  return c.json(
    {
      success: true as const,
      data: result.users,
      pagination: result.pagination,
    },
    200
  );
};

export const getUserHandler: RouteHandler<
  typeof getUserRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const user = await UsersService.getUserById(c.var.db, id);
  if (!user) {
    return c.json({ success: false as const, message: "User not found" }, 404);
  }
  return c.json({ success: true as const, data: user }, 200);
};

export const updateRoleHandler: RouteHandler<
  typeof updateRoleRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const tenantRoleId = (body as { tenantRoleId?: string; role?: string }).tenantRoleId ?? (body as { tenantRoleId?: string; role?: string }).role;
  const adminId = c.get("userId")!;
  try {
    const user = await UsersService.updateRole(c.var.db, id, tenantRoleId!, adminId);
    return c.json({ success: true as const, data: user }, 200);
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 400;
    return c.json({ success: false as const, message: err.message }, status);
  }
};

export const assignBranchHandler: RouteHandler<
  typeof assignBranchRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const adminId = c.get("userId")!;
  try {
    const result = await UsersService.assignBranch(
      c.var.db,
      id,
      body.branchId!,
      adminId
    );
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: any) {
    return c.json({ success: false as const, message: err.message }, 400);
  }
};

export const removeBranchHandler: RouteHandler<
  typeof removeBranchRoute,
  AppEnv
> = async (c) => {
  const { id, branchId } = c.req.valid("param");
  const adminId = c.get("userId") as string;
  try {
    const result = await UsersService.removeBranchAssignment(
      c.var.db,
      id,
      branchId,
      adminId
    );
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: any) {
    return c.json({ success: false as const, message: err.message }, 404);
  }
};

export const deactivateUserHandler: RouteHandler<
  typeof deactivateUserRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const adminId = c.get("userId") as string;
  try {
    const user = await UsersService.deactivateUser(c.var.db, id, adminId);
    return c.json({ success: true as const, data: user }, 200);
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 400;
    return c.json({ success: false as const, message: err.message }, status);
  }
};

export const reactivateUserHandler: RouteHandler<
  typeof reactivateUserRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const adminId = c.get("userId") as string;
  try {
    const user = await UsersService.reactivateUser(c.var.db, id, adminId);
    return c.json({ success: true as const, data: user }, 200);
  } catch (err: any) {
    return c.json({ success: false as const, message: err.message }, 404);
  }
};
