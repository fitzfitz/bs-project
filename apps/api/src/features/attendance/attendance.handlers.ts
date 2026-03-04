import { createRoute, z } from "@hono/zod-openapi";
import {
  clockInSchema,
  clockOutSchema,
  attendanceIdParam,
  listAttendanceQuery,
  createShiftBlockSchema,
  updateShiftBlockSchema,
  shiftBlockIdParam,
  listShiftsQuery,
} from "./attendance.schema";
import { AttendanceService } from "./attendance.service";
import {
  createSuccessSchema,
  createPaginatedSuccessSchema,
  MessageSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

// ============================================================================
// Route Definitions
// ============================================================================

const GenericAttendanceResponseSchema = createSuccessSchema(z.any());
const GenericShiftResponseSchema = createSuccessSchema(z.any());

export const listAttendanceRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Attendance"],
  summary: "List attendance records",
  security: [{ bearerAuth: [] }],
  request: { query: listAttendanceQuery },
  responses: {
    200: {
      content: {
        "application/json": { schema: createPaginatedSuccessSchema(z.any()) },
      },
      description: "Array of attendance records with pagination",
    },
  },
});

export const clockInRoute = createRoute({
  method: "post",
  path: "/clock-in",
  tags: ["Attendance"],
  summary: "Clock in staff",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: clockInSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: GenericAttendanceResponseSchema },
      },
      description: "Clocked in successfully",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const clockOutRoute = createRoute({
  method: "patch",
  path: "/{id}/clock-out",
  tags: ["Attendance"],
  summary: "Clock out staff",
  security: [{ bearerAuth: [] }],
  request: {
    params: attendanceIdParam,
    body: {
      content: { "application/json": { schema: clockOutSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: GenericAttendanceResponseSchema },
      },
      description: "Clocked out successfully",
    },
  },
});

export const listShiftsRoute = createRoute({
  method: "get",
  path: "/shifts",
  tags: ["Shifts & Blocks"],
  summary: "List shifts and schedule blocks",
  security: [{ bearerAuth: [] }],
  request: { query: listShiftsQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(z.any())),
        },
      },
      description: "Array of shift blocks",
    },
  },
});

export const createShiftBlockRoute = createRoute({
  method: "post",
  path: "/shifts",
  tags: ["Shifts & Blocks"],
  summary: "Create shift block",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createShiftBlockSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: GenericShiftResponseSchema } },
      description: "Shift block created",
    },
  },
});

export const updateShiftBlockRoute = createRoute({
  method: "patch",
  path: "/shifts/{id}",
  tags: ["Shifts & Blocks"],
  summary: "Update shift block",
  security: [{ bearerAuth: [] }],
  request: {
    params: shiftBlockIdParam,
    body: {
      content: { "application/json": { schema: updateShiftBlockSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GenericShiftResponseSchema } },
      description: "Shift block updated",
    },
  },
});

export const deleteShiftBlockRoute = createRoute({
  method: "delete",
  path: "/shifts/{id}",
  tags: ["Shifts & Blocks"],
  summary: "Delete shift block",
  security: [{ bearerAuth: [] }],
  request: { params: shiftBlockIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Shift block deleted",
    },
  },
});

// ============================================================================
// Route Handlers
// ============================================================================

export const listAttendanceHandler: RouteHandler<
  typeof listAttendanceRoute,
  AppEnv
> = async (c) => {
  const filters = c.req.valid("query");
  const result = await AttendanceService.listAttendance(c.var.db, filters);
  return c.json(
    {
      success: true as const,
      data: result.data,
      pagination: result.pagination,
    },
    200
  );
};

export const clockInHandler: RouteHandler<
  typeof clockInRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json(
      { success: false as const, message: "Unauthorized" },
      401
    );
  }
  const data = c.req.valid("json");
  const attendance = await AttendanceService.clockIn(c.var.db, userId, data);
  return c.json({ success: true as const, data: attendance }, 201);
};

export const clockOutHandler: RouteHandler<
  typeof clockOutRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const attendance = await AttendanceService.clockOut(c.var.db, id, data);
  return c.json({ success: true as const, data: attendance }, 200);
};

export const listShiftsHandler: RouteHandler<
  typeof listShiftsRoute,
  AppEnv
> = async (c) => {
  const filters = c.req.valid("query");
  const shifts = await AttendanceService.listShifts(c.var.db, filters);
  return c.json({ success: true as const, data: shifts }, 200);
};

export const createShiftBlockHandler: RouteHandler<
  typeof createShiftBlockRoute,
  AppEnv
> = async (c) => {
  const data = c.req.valid("json");
  const shift = await AttendanceService.createShiftBlock(c.var.db, data);
  return c.json({ success: true as const, data: shift }, 201);
};

export const updateShiftBlockHandler: RouteHandler<
  typeof updateShiftBlockRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const shift = await AttendanceService.updateShiftBlock(c.var.db, id, data);
  return c.json({ success: true as const, data: shift }, 200);
};

export const deleteShiftBlockHandler: RouteHandler<
  typeof deleteShiftBlockRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  await AttendanceService.deleteShiftBlock(c.var.db, id);
  return c.json(
    { success: true as const, message: "Shift block deleted" },
    200
  );
};
