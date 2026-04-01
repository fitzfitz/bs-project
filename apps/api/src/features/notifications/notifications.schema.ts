import { createRoute, z } from "@hono/zod-openapi";
import {
  createSuccessSchema,
  createPaginatedSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";

export const NotificationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  type: z.string(),
  data: z.any().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const listNotificationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationIdParam = z.object({
  id: z.string().min(1),
});

export const listNotificationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Notifications"],
  summary: "List current user's notifications",
  security: [{ bearerAuth: [] }],
  request: { query: listNotificationsQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(NotificationItemSchema),
        },
      },
      description: "Paginated notifications",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const unreadCountRoute = createRoute({
  method: "get",
  path: "/unread-count",
  tags: ["Notifications"],
  summary: "Get unread notification count",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ count: z.number().int() })),
        },
      },
      description: "Unread count",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const markReadRoute = createRoute({
  method: "patch",
  path: "/{id}/read",
  tags: ["Notifications"],
  summary: "Mark a notification as read",
  security: [{ bearerAuth: [] }],
  request: { params: notificationIdParam },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ id: z.string(), read: z.boolean() })),
        },
      },
      description: "Notification marked as read",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Notification not found",
    },
  },
});

export const markAllReadRoute = createRoute({
  method: "post",
  path: "/mark-all-read",
  tags: ["Notifications"],
  summary: "Mark all notifications as read",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ updated: z.number().int() })),
        },
      },
      description: "All notifications marked as read",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

// ─── Channel Config Endpoints ────────────────────────────────────────────────

export const channelConfigSchema = z.object({
  notificationType: z.string(),
  pushEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  smsEnabled: z.boolean(),
});

export const upsertChannelConfigBody = z.object({
  pushEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  smsEnabled: z.boolean(),
});

export const channelTypeParam = z.object({
  notificationType: z.string().min(1),
});

export const listChannelsRoute = createRoute({
  method: "get",
  path: "/channels",
  tags: ["Notifications"],
  summary: "List notification channel configs for organization",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(channelConfigSchema)),
        },
      },
      description: "Channel configs",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
  },
});

export const upsertChannelRoute = createRoute({
  method: "put",
  path: "/channels/{notificationType}",
  tags: ["Notifications"],
  summary: "Upsert channel config for a notification type",
  security: [{ bearerAuth: [] }],
  request: {
    params: channelTypeParam,
    body: { content: { "application/json": { schema: upsertChannelConfigBody } } },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(channelConfigSchema),
        },
      },
      description: "Channel config upserted",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
  },
});

// ─── Notification Preferences ───────────────────────────────────────────────

export const preferenceSchema = z.object({
  pushOptOut: z.boolean(),
  whatsappOptOut: z.boolean(),
  smsOptOut: z.boolean(),
});

export const getPreferencesRoute = createRoute({
  method: "get",
  path: "/preferences",
  tags: ["Notifications"],
  summary: "Get current user notification preferences",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(preferenceSchema),
        },
      },
      description: "User preferences",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
  },
});

export const updatePreferencesRoute = createRoute({
  method: "put",
  path: "/preferences",
  tags: ["Notifications"],
  summary: "Update current user notification preferences",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: preferenceSchema } } },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(preferenceSchema),
        },
      },
      description: "Preferences updated",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
  },
});

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

export const AdminNotificationItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  type: z.string(),
  data: z.any().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }),
});

export const adminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().optional(),
  type: z.string().optional(),
  read: z.coerce.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const adminListRoute = createRoute({
  method: "get",
  path: "/admin",
  tags: ["Notifications"],
  summary: "List all notifications in the organization (admin)",
  security: [{ bearerAuth: [] }],
  request: { query: adminListQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(AdminNotificationItemSchema),
        },
      },
      description: "Paginated org-wide notifications",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
  },
});

export const adminStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  tags: ["Notifications"],
  summary: "Get notification delivery stats (admin)",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(
            z.object({
              totalSent: z.number().int(),
              totalUnread: z.number().int(),
              last30Days: z.number().int(),
              byType: z.array(
                z.object({ type: z.string(), count: z.number().int() }),
              ),
            }),
          ),
        },
      },
      description: "Notification stats",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
  },
});

export const testSendBody = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  type: z.string().default("TEST"),
});

export const adminTestSendRoute = createRoute({
  method: "post",
  path: "/admin/test-send",
  tags: ["Notifications"],
  summary: "Send a test notification to a user (admin)",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: testSendBody } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(
            z.object({ notificationId: z.string(), pushSent: z.boolean() }),
          ),
        },
      },
      description: "Test notification sent",
    },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "User not found" },
  },
});
