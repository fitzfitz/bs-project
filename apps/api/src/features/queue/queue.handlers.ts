import { createRoute, z } from "@hono/zod-openapi";
import {
  createBookingSchema,
  updateQueueStatusSchema,
  assignStaffToQueueSchema,
  postponeQueueSchema,
  rescheduleSchema,
  prepayBody,
  prepayResponseData,
  entryIdParam,
  listQueueQuery,
  QueueEntryScalarSchema,
  QueueEntryListItemSchema,
  QueueEntryDetailSchema,
  QueueEntryUserViewSchema,
} from "./queue.schema";
import { QueueService } from "./queue.service";
import {
  createSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import { getPusher } from "../../utils/pusher";
import { createNotificationService } from "../../utils/notifications";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

// ============================================================================
// Route Definitions
// ============================================================================

export const listQueueRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Queue & Booking"],
  summary: "List queue entries",
  request: { query: listQueueQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(QueueEntryListItemSchema)),
        },
      },
      description: "Array of queue entries",
    },
  },
});

export const getEntryRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Queue & Booking"],
  summary: "Get queue entry by ID",
  request: { params: entryIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryDetailSchema) },
      },
      description: "Queue entry details",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Entry not found",
    },
  },
});

export const createEntryRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Queue & Booking"],
  summary: "Create booking or walk-in entry",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createBookingSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryScalarSchema) },
      },
      description: "Entry created",
    },
  },
});

export const updateStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  tags: ["Queue & Booking"],
  summary: "Update entry status",
  security: [{ bearerAuth: [] }],
  request: {
    params: entryIdParam,
    body: {
      content: { "application/json": { schema: updateQueueStatusSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryScalarSchema) },
      },
      description: "Status updated",
    },
  },
});

export const assignStaffRoute = createRoute({
  method: "post",
  path: "/{id}/assign",
  tags: ["Queue & Booking (Ops)"],
  summary: "Assign staff to entry",
  security: [{ bearerAuth: [] }],
  request: {
    params: entryIdParam,
    body: {
      content: { "application/json": { schema: assignStaffToQueueSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryScalarSchema) },
      },
      description: "Staff assigned",
    },
  },
});

export const postponeEntryRoute = createRoute({
  method: "post",
  path: "/{id}/postpone",
  tags: ["Queue & Booking (Ops)"],
  summary: "Postpone entry",
  security: [{ bearerAuth: [] }],
  request: {
    params: entryIdParam,
    body: {
      content: { "application/json": { schema: postponeQueueSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryScalarSchema) },
      },
      description: "Entry postponed",
    },
  },
});

export const cancelEntryRoute = createRoute({
  method: "post",
  path: "/{id}/cancel",
  tags: ["Queue & Booking (Ops)"],
  summary: "Cancel entry",
  security: [{ bearerAuth: [] }],
  request: { params: entryIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryScalarSchema) },
      },
      description: "Entry cancelled",
    },
  },
});

export const customerCancelRoute = createRoute({
  method: "post",
  path: "/{id}/customer-cancel",
  tags: ["Queue & Booking (Customer)"],
  summary: "Customer cancels own booking",
  security: [{ bearerAuth: [] }],
  request: { params: entryIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryScalarSchema) },
      },
      description: "Entry cancelled",
    },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid status" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Not your booking" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Entry not found" },
  },
});

export const prepayRoute = createRoute({
  method: "post",
  path: "/{id}/prepay",
  tags: ["Queue & Booking (Customer)"],
  summary: "Create Xendit prepayment invoice for a waiting queue entry",
  security: [{ bearerAuth: [] }],
  request: {
    params: entryIdParam,
    body: {
      content: { "application/json": { schema: prepayBody } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(prepayResponseData) },
      },
      description: "Invoice created",
    },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Prepay not available" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

export const rescheduleRoute = createRoute({
  method: "patch",
  path: "/{id}/reschedule",
  tags: ["Queue & Booking (Customer)"],
  summary: "Reschedule booking to a new time",
  security: [{ bearerAuth: [] }],
  request: {
    params: entryIdParam,
    body: {
      content: { "application/json": { schema: rescheduleSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(QueueEntryUserViewSchema) },
      },
      description: "Entry rescheduled",
    },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid status" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Not your booking" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Entry not found" },
    409: { content: { "application/json": { schema: ErrorSchema } }, description: "Slot conflict" },
  },
});

export const meQueueRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Queue & Booking"],
  summary: "Get current user's active/past entries",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(QueueEntryUserViewSchema)),
        },
      },
      description: "User's queue entries",
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

export const listQueueHandler: RouteHandler<
  typeof listQueueRoute,
  AppEnv
> = async (c) => {
  const filters = c.req.valid("query");
  const queue = await QueueService.listQueue(c.var.db, filters);
  return c.json({ success: true as const, data: queue }, 200);
};

export const getEntryHandler: RouteHandler<
  typeof getEntryRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const entry = await QueueService.getEntryById(c.var.db, id);
  if (!entry) {
    return c.json(
      { success: false as const, message: "Queue entry not found" },
      404
    );
  }
  return c.json({ success: true as const, data: entry }, 200);
};

export const createEntryHandler: RouteHandler<
  typeof createEntryRoute,
  AppEnv
> = async (c) => {
  const data = c.req.valid("json");
  const callerId = c.get("userId");
  const scope = c.get("scope");

  if (scope === "CUSTOMER") {
    data.customerId = callerId;
    data.source = "APP";
  }

  const organizationId = c.get("organizationId")!;
  const pusher = getPusher(c);
  const ns = createNotificationService(c.env);
  const entry = await QueueService.createEntry(c.var.db, data, organizationId, pusher, ns);
  return c.json({ success: true as const, data: entry }, 201);
};

export const updateStatusHandler: RouteHandler<
  typeof updateStatusRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const organizationId = c.get("organizationId")!;
  const pusher = getPusher(c);
  const ns = createNotificationService(c.env);
  const entry = await QueueService.updateStatus(c.var.db, id, data, organizationId, pusher, ns);
  return c.json({ success: true as const, data: entry }, 200);
};

export const assignStaffHandler: RouteHandler<
  typeof assignStaffRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const pusher = getPusher(c);
  const entry = await QueueService.assignStaff(c.var.db, id, data, pusher);
  return c.json({ success: true as const, data: entry }, 200);
};

export const postponeEntryHandler: RouteHandler<
  typeof postponeEntryRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const { minutes } = c.req.valid("json");
  const pusher = getPusher(c);
  const entry = await QueueService.postponeEntry(c.var.db, id, minutes, pusher);
  return c.json({ success: true as const, data: entry }, 200);
};

export const cancelEntryHandler: RouteHandler<
  typeof cancelEntryRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const pusher = getPusher(c);
  const entry = await QueueService.cancelEntry(c.var.db, id, pusher);
  return c.json({ success: true as const, data: entry }, 200);
};

export const meQueueHandler: RouteHandler<typeof meQueueRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ success: false as const, message: "Unauthorized" }, 401);
  }
  const entries = await QueueService.getUserEntries(c.var.db, userId as string);
  return c.json({ success: true as const, data: entries }, 200);
};

export const customerCancelHandler: RouteHandler<typeof customerCancelRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const userId = c.get("userId") as string;
  const pusher = getPusher(c);
  const ns = createNotificationService(c.env);
  const entry = await QueueService.customerCancelEntry(c.var.db, id, userId, pusher, ns);
  return c.json({ success: true as const, data: entry }, 200);
};

export const prepayHandler: RouteHandler<typeof prepayRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { successRedirectUrl, failureRedirectUrl } = c.req.valid("json");
  const secretKey = c.env.XENDIT_SECRET_KEY;
  if (!secretKey) {
    return c.json({ success: false as const, message: "Payment gateway not configured" }, 400);
  }
  const userId = c.get("userId") as string;
  const organizationId = c.get("organizationId") as string;
  const result = await QueueService.prepayEntry(c.var.db, id, userId, organizationId, {
    successRedirectUrl,
    failureRedirectUrl,
    secretKey,
  });
  return c.json({ success: true as const, data: result }, 200);
};

export const rescheduleHandler: RouteHandler<typeof rescheduleRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { startTime } = c.req.valid("json");
  const userId = c.get("userId") as string;
  const pusher = getPusher(c);
  const entry = await QueueService.rescheduleEntry(c.var.db, id, userId, startTime, pusher);
  return c.json({ success: true as const, data: entry }, 200);
};

// ============================================================================
// Availability
// ============================================================================

export const availabilityRoute = createRoute({
  method: "get",
  path: "/availability",
  tags: ["Queue & Booking"],
  summary: "Get available time slots for a branch/date",
  request: {
    query: z.object({
      branchId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
      staffProfileId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Available slots",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(
              z.object({
                time: z.string(),
                available: z.boolean(),
              })
            ),
          }),
        },
      },
    },
  },
});

export const availabilityHandler: RouteHandler<typeof availabilityRoute, AppEnv> = async (c) => {
  const { branchId, date, staffProfileId } = c.req.valid("query");
  const slots = await QueueService.getAvailableSlots(c.var.db, branchId, date, staffProfileId);
  return c.json({ success: true as const, data: slots }, 200);
};
