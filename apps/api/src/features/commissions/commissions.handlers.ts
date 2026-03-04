import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { CommissionService } from "./commissions.service";
import {
  calculateCommissionSchema,
  recalculateDaySchema,
  listEarningsQuerySchema,
  staffProfileIdParamSchema,
  StaffEarningSchema,
} from "./commissions.schema";
import { createPaginatedSuccessSchema } from "../../utils/openapi";

export const calculateRoute = createRoute({
  method: "post",
  path: "/calculate",
  tags: ["Commissions"],
  summary: "Calculate daily commission",
  description: "Calculates and upserts staff earning for the given staff and date.",
  request: {
    body: {
      content: { "application/json": { schema: calculateCommissionSchema } },
    },
  },
  responses: {
    200: {
      description: "Earning calculated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: StaffEarningSchema,
          }),
        },
      },
    },
    400: { description: "Bad request" },
    404: { description: "Staff not found" },
    500: { description: "Internal server error" },
  },
});

export const recalculateRoute = createRoute({
  method: "post",
  path: "/recalculate",
  tags: ["Commissions"],
  summary: "Recalculate day",
  description: "Deletes existing earning and recomputes for the staff and date.",
  request: {
    body: {
      content: { "application/json": { schema: recalculateDaySchema } },
    },
  },
  responses: {
    200: {
      description: "Earning recalculated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: StaffEarningSchema,
          }),
        },
      },
    },
    404: { description: "Staff not found" },
    500: { description: "Internal server error" },
  },
});

const EarningWithStaffSchema = StaffEarningSchema.extend({
  staff: z.object({
    id: z.string(),
    user: z.object({
      firstName: z.string(),
      lastName: z.string(),
    }),
  }),
});

export const listEarningsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Commissions"],
  summary: "List earnings",
  description: "List earnings with optional filters. Managers see by staff; staff sees own.",
  request: { query: listEarningsQuerySchema },
  responses: {
    200: {
      description: "Paginated earnings",
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(EarningWithStaffSchema),
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Commissions"],
  summary: "Get my earnings",
  description: "Staff retrieves own earnings with optional date range.",
  request: { query: listEarningsQuerySchema.omit({ staffProfileId: true }) },
  responses: {
    200: {
      description: "Paginated earnings",
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(EarningWithStaffSchema),
        },
      },
    },
    403: { description: "User is not staff" },
    500: { description: "Internal server error" },
  },
});

export const getByStaffProfileIdRoute = createRoute({
  method: "get",
  path: "/{staffProfileId}",
  tags: ["Commissions"],
  summary: "Get earnings by staff",
  description: "Managers/Super Admins retrieve earnings for a specific staff member.",
  request: {
    params: staffProfileIdParamSchema,
    query: listEarningsQuerySchema.omit({ staffProfileId: true }),
  },
  responses: {
    200: {
      description: "Paginated earnings",
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(EarningWithStaffSchema),
        },
      },
    },
    404: { description: "Staff not found" },
    500: { description: "Internal server error" },
  },
});

export const calculateHandler: RouteHandler<typeof calculateRoute, AppEnv> = async (c) => {
  try {
    const { staffProfileId, date } = c.req.valid("json");
    const dateObj = new Date(date);
    const earning = await CommissionService.calculateDaily(c.var.db, staffProfileId, dateObj);
    return c.json({
      success: true as const,
      data: {
        ...earning,
        date: earning.date.toISOString().slice(0, 10),
        createdAt: earning.createdAt.toISOString(),
      },
    }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message === "Staff not found") return c.json({ success: false, message }, 404);
    console.error("Commission calculate:", err);
    return c.json({ success: false, message }, 500);
  }
};

export const recalculateHandler: RouteHandler<typeof recalculateRoute, AppEnv> = async (c) => {
  try {
    const { staffProfileId, date } = c.req.valid("json");
    const dateObj = new Date(date);
    const earning = await CommissionService.recalculateDay(c.var.db, staffProfileId, dateObj);
    return c.json({
      success: true as const,
      data: {
        ...earning,
        date: earning.date.toISOString().slice(0, 10),
        createdAt: earning.createdAt.toISOString(),
      },
    }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message === "Staff not found") return c.json({ success: false, message }, 404);
    console.error("Commission recalculate:", err);
    return c.json({ success: false, message }, 500);
  }
};

export const listEarningsHandler: RouteHandler<typeof listEarningsRoute, AppEnv> = async (c) => {
  try {
    const query = c.req.valid("query");
    const result = await CommissionService.getEarnings(c.var.db, query);
    const data = result.items.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
      createdAt: e.createdAt.toISOString(),
      staff: {
        id: e.staff.id,
        user: e.staff.user,
      },
    }));
    return c.json({
      success: true as const,
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    }, 200);
  } catch (err) {
    console.error("List earnings:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getMeHandler: RouteHandler<typeof getMeRoute, AppEnv> = async (c) => {
  try {
    const userId = c.var.userId;
    if (!userId) return c.json({ success: false, message: "Unauthorized" }, 401);
    const staffProfile = await c.var.db.staffProfile.findFirst({
      where: { userId },
    });
    if (!staffProfile) return c.json({ success: false, message: "User is not staff" }, 403);
    const query = c.req.valid("query");
    const result = await CommissionService.getEarningsForBarber(c.var.db, staffProfile.id, query);
    const data = result.items.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
      createdAt: e.createdAt.toISOString(),
      staff: {
        id: e.staff.id,
        user: e.staff.user,
      },
    }));
    return c.json({
      success: true as const,
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    }, 200);
  } catch (err) {
    console.error("Get my earnings:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getByStaffProfileIdHandler: RouteHandler<typeof getByStaffProfileIdRoute, AppEnv> = async (c) => {
  try {
    const staffProfileId = c.req.param("staffProfileId");
    const query = c.req.valid("query");
    const result = await CommissionService.getEarningsForBarber(c.var.db, staffProfileId, query);
    const data = result.items.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
      createdAt: e.createdAt.toISOString(),
      staff: {
        id: e.staff.id,
        user: e.staff.user,
      },
    }));
    return c.json({
      success: true as const,
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    }, 200);
  } catch (err) {
    console.error("Get earnings by staff:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};
