import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import type {
  listNotificationsRoute,
  unreadCountRoute,
  markReadRoute,
  markAllReadRoute,
  listChannelsRoute,
  upsertChannelRoute,
  getPreferencesRoute,
  updatePreferencesRoute,
  adminListRoute,
  adminStatsRoute,
  adminTestSendRoute,
} from "./notifications.schema";
import { createNotificationService } from "../../utils/notifications";

export const listNotificationsHandler: RouteHandler<
  typeof listNotificationsRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId") as string;
  const { page, limit } = c.req.valid("query");
  const db = c.var.db;

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.notification.count({ where: { userId } }),
  ]);

  return c.json(
    {
      success: true as const,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    200,
  );
};

export const unreadCountHandler: RouteHandler<
  typeof unreadCountRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId") as string;
  const count = await c.var.db.notification.count({
    where: { userId, read: false },
  });
  return c.json({ success: true as const, data: { count } }, 200);
};

export const markReadHandler: RouteHandler<
  typeof markReadRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  const notification = await c.var.db.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    return c.json(
      { success: false as const, message: "Notification not found" },
      404,
    );
  }

  const updated = await c.var.db.notification.update({
    where: { id },
    data: { read: true },
  });

  return c.json(
    { success: true as const, data: { id: updated.id, read: updated.read } },
    200,
  );
};

export const markAllReadHandler: RouteHandler<
  typeof markAllReadRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId") as string;
  const result = await c.var.db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return c.json(
    { success: true as const, data: { updated: result.count } },
    200,
  );
};

// ─── Channel Config Handlers ─────────────────────────────────────────────────

export const listChannelsHandler: RouteHandler<
  typeof listChannelsRoute,
  AppEnv
> = async (c) => {
  const orgId = c.get("organizationId") as string;
  const configs = await c.var.db.notificationChannelConfig.findMany({
    where: { organizationId: orgId },
    select: { notificationType: true, pushEnabled: true, whatsappEnabled: true, smsEnabled: true, emailEnabled: true },
  });
  return c.json({ success: true as const, data: configs }, 200);
};

export const upsertChannelHandler: RouteHandler<
  typeof upsertChannelRoute,
  AppEnv
> = async (c) => {
  const orgId = c.get("organizationId") as string;
  const { notificationType } = c.req.valid("param");
  const { pushEnabled, whatsappEnabled, smsEnabled, emailEnabled } = c.req.valid("json");

  const config = await c.var.db.notificationChannelConfig.upsert({
    where: {
      organizationId_notificationType: { organizationId: orgId, notificationType },
    },
    create: { organizationId: orgId, notificationType, pushEnabled, whatsappEnabled, smsEnabled, emailEnabled },
    update: { pushEnabled, whatsappEnabled, smsEnabled, emailEnabled },
    select: { notificationType: true, pushEnabled: true, whatsappEnabled: true, smsEnabled: true, emailEnabled: true },
  });

  return c.json({ success: true as const, data: config }, 200);
};

// ─── Preferences Handlers ───────────────────────────────────────────────────

export const getPreferencesHandler: RouteHandler<
  typeof getPreferencesRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId") as string;

  const pref = await c.var.db.notificationPreference.findUnique({
    where: { userId },
    select: { pushOptOut: true, whatsappOptOut: true, smsOptOut: true, emailOptOut: true },
  });

  return c.json(
    {
      success: true as const,
      data: pref ?? { pushOptOut: false, whatsappOptOut: false, smsOptOut: false, emailOptOut: false },
    },
    200,
  );
};

export const updatePreferencesHandler: RouteHandler<
  typeof updatePreferencesRoute,
  AppEnv
> = async (c) => {
  const userId = c.get("userId") as string;
  const orgId = c.get("organizationId") as string;
  const { pushOptOut, whatsappOptOut, smsOptOut, emailOptOut } = c.req.valid("json");

  // Use a transaction to ensure both fields stay in sync
  const pref = await c.var.db.$transaction(async (tx) => {
    const p = await tx.notificationPreference.upsert({
      where: { userId },
      create: { 
        organizationId: orgId, 
        userId, 
        pushOptOut, 
        whatsappOptOut, 
        smsOptOut, 
        emailOptOut 
      },
      update: { 
        pushOptOut, 
        whatsappOptOut, 
        smsOptOut, 
        emailOptOut 
      },
      select: { pushOptOut: true, whatsappOptOut: true, smsOptOut: true, emailOptOut: true },
    });

    // Sync legacy emailOptIn field on User
    await tx.user.update({
      where: { id: userId },
      data: { emailOptIn: !emailOptOut },
    });

    return p;
  });

  return c.json({ success: true as const, data: pref }, 200);
};

// ─── Admin Handlers ───────────────────────────────────────────────────────────

export const adminListHandler: RouteHandler<
  typeof adminListRoute,
  AppEnv
> = async (c) => {
  const orgId = c.get("organizationId") as string;
  const { page, limit, userId, type, read, from, to } = c.req.valid("query");
  const db = c.var.db;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (userId) where.userId = userId;
  if (type) where.type = type;
  if (read !== undefined) where.read = read;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    db.notification.count({ where }),
  ]);

  return c.json(
    {
      success: true as const,
      data: notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
    200,
  );
};

export const adminStatsHandler: RouteHandler<
  typeof adminStatsRoute,
  AppEnv
> = async (c) => {
  const orgId = c.get("organizationId") as string;
  const db = c.var.db;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalSent, totalUnread, last30Days, byType] = await Promise.all([
    db.notification.count({ where: { organizationId: orgId } }),
    db.notification.count({ where: { organizationId: orgId, read: false } }),
    db.notification.count({
      where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
    }),
    db.notification.groupBy({
      by: ["type"],
      where: { organizationId: orgId },
      _count: { type: true },
    }),
  ]);

  return c.json(
    {
      success: true as const,
      data: {
        totalSent,
        totalUnread,
        last30Days,
        byType: byType.map((g) => ({ type: g.type, count: g._count.type })),
      },
    },
    200,
  );
};

export const adminTestSendHandler: RouteHandler<
  typeof adminTestSendRoute,
  AppEnv
> = async (c) => {
  const orgId = c.get("organizationId") as string;
  const db = c.var.db;
  const { userId, title, body, type, sendEmail } = c.req.valid("json");

  const user = await db.user.findFirst({
    where: { id: userId, organizationId: orgId },
  });
  if (!user) {
    return c.json({ success: false as const, message: "User not found" }, 404);
  }

  const notification = await db.notification.create({
    data: { organizationId: orgId, userId, title, body, type },
  });

  const ns = createNotificationService(c.env, c.var.db);
  const pushSent = await ns.sendPush(userId, title, body, { type });
  
  let emailSent = false;
  if (sendEmail) {
    emailSent = await ns.sendEmail(
      userId, 
      `Test: ${title}`, 
      `<html><body><h1>${title}</h1><p>${body}</p><p><small>Sent via Admin Test Tool</small></p></body></html>`
    );
  }

  return c.json(
    { 
      success: true as const, 
      data: { notificationId: notification.id, pushSent, emailSent } 
    },
    200,
  );
};
