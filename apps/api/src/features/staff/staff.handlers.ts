import { createRoute, z } from "@hono/zod-openapi";
import {
  createStaffProfileSchema,
  updateStaffProfileSchema,
  staffIdParam,
  listStaffQuery,
  assignStaffSchema,
  StaffStatusEnum,
} from "./staff.schema";
import { StaffService } from "./staff.service";
import {
  createSuccessSchema,
  createPaginatedSuccessSchema,
  MessageSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

const GenericStaffResponseSchema = createSuccessSchema(z.any());

export const listStaffRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Staff"],
  summary: "List staff profiles",
  request: { query: listStaffQuery },
  responses: {
    200: {
      content: {
        "application/json": { schema: createPaginatedSuccessSchema(z.any()) },
      },
      description: "Array of staff with pagination metadata",
    },
  },
});

export const getStaffRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Staff"],
  summary: "Get staff profile by ID",
  request: { params: staffIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: GenericStaffResponseSchema } },
      description: "Staff details",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Staff not found",
    },
  },
});

export const createStaffRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Staff"],
  summary: "Create staff profile",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createStaffProfileSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: GenericStaffResponseSchema } },
      description: "Staff profile created",
    },
  },
});

export const updateStaffRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Staff"],
  summary: "Update staff profile",
  security: [{ bearerAuth: [] }],
  request: {
    params: staffIdParam,
    body: {
      content: { "application/json": { schema: updateStaffProfileSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GenericStaffResponseSchema } },
      description: "Staff profile updated",
    },
  },
});

export const deleteStaffRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Staff"],
  summary: "Deactivate staff profile",
  security: [{ bearerAuth: [] }],
  request: { params: staffIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Staff deactivated",
    },
  },
});

export const assignToBranchRoute = createRoute({
  method: "post",
  path: "/{id}/branches",
  tags: ["Staff (Assignments)"],
  summary: "Assign staff to branch",
  security: [{ bearerAuth: [] }],
  request: {
    params: staffIdParam,
    body: {
      content: { "application/json": { schema: assignStaffSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: GenericStaffResponseSchema } },
      description: "Assignment created",
    },
  },
});

export const removeFromBranchRoute = createRoute({
  method: "delete",
  path: "/{id}/branches",
  tags: ["Staff (Assignments)"],
  summary: "Remove staff from branch",
  security: [{ bearerAuth: [] }],
  request: { params: staffIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Removal successful",
    },
  },
});

export const updateStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  tags: ["Staff"],
  summary: "Update staff working status",
  security: [{ bearerAuth: [] }],
  request: {
    params: staffIdParam,
    body: {
      content: {
        "application/json": {
          schema: z.object({ status: StaffStatusEnum }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GenericStaffResponseSchema } },
      description: "Status updated",
    },
  },
});

export const listStaffHandler: RouteHandler<
  typeof listStaffRoute,
  AppEnv
> = async (c) => {
  const filters = c.req.valid("query");
  const result = await StaffService.list(c.var.db, filters);

  return c.json(
    {
      success: true as const,
      data: result.data,
      pagination: result.pagination,
    },
    200
  );
};

export const getStaffHandler: RouteHandler<
  typeof getStaffRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const staff = await StaffService.getById(c.var.db, id);

  if (!staff) {
    return c.json(
      { success: false as const, message: "Staff not found" },
      404
    );
  }

  return c.json({ success: true as const, data: staff }, 200);
};

export const createStaffHandler: RouteHandler<
  typeof createStaffRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const data = c.req.valid("json");
  const staff = await StaffService.create(c.var.db, organizationId, data);

  return c.json({ success: true as const, data: staff }, 201);
};

export const updateStaffHandler: RouteHandler<
  typeof updateStaffRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const staff = await StaffService.update(c.var.db, id, data);

  return c.json({ success: true as const, data: staff }, 200);
};

export const deleteStaffHandler: RouteHandler<
  typeof deleteStaffRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  await StaffService.toggleActive(c.var.db, id, false);

  return c.json(
    { success: true as const, message: "Staff profile deactivated" },
    200
  );
};

export const assignToBranchHandler: RouteHandler<
  typeof assignToBranchRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const { branchId } = c.req.valid("json");
  const assignment = await StaffService.assignToBranch(c.var.db, id, branchId);

  return c.json({ success: true as const, data: assignment }, 201);
};

export const removeFromBranchHandler: RouteHandler<
  typeof removeFromBranchRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  await StaffService.removeFromBranch(c.var.db, id);

  return c.json(
    { success: true as const, message: "Staff removed from branch" },
    200
  );
};

export const updateStatusHandler: RouteHandler<
  typeof updateStatusRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const { status } = c.req.valid("json");
  const updated = await StaffService.updateStatus(c.var.db, id, status);

  return c.json({ success: true as const, data: updated }, 200);
};
