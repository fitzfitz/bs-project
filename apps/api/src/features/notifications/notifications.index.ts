import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { orgScopeMiddleware } from "../../middlewares/scope";
import { requirePermission } from "../../middlewares/rbac";
import {
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
import {
  listNotificationsHandler,
  unreadCountHandler,
  markReadHandler,
  markAllReadHandler,
  listChannelsHandler,
  upsertChannelHandler,
  getPreferencesHandler,
  updatePreferencesHandler,
  adminListHandler,
  adminStatsHandler,
  adminTestSendHandler,
} from "./notifications.handlers";

const app = new OpenAPIHono<AppEnv>();

app.use("*", authMiddleware(), orgScopeMiddleware());

// User-scoped inbox routes (no extra permission required)
app.openapi(listNotificationsRoute, listNotificationsHandler);
app.openapi(unreadCountRoute, unreadCountHandler);
app.openapi(markReadRoute, markReadHandler);
app.openapi(markAllReadRoute, markAllReadHandler);

// User-scoped notification preferences (no feature code required)
app.openapi(getPreferencesRoute, getPreferencesHandler);
app.openapi(updatePreferencesRoute, updatePreferencesHandler);

// Channel config — gated by ORG_SETTINGS (path-scoped to avoid leaking into other routes)
app.use("/channels", requirePermission("ORG_SETTINGS", "read"));
app.use("/channels/*", requirePermission("ORG_SETTINGS", "update"));
app.openapi(listChannelsRoute, listChannelsHandler);
app.openapi(upsertChannelRoute, upsertChannelHandler);

// Admin routes — gated by CAMPAIGNS read permission (path-scoped)
app.use("/admin", requirePermission("CAMPAIGNS", "read"));
app.use("/admin/*", requirePermission("CAMPAIGNS", "read"));
app.openapi(adminListRoute, adminListHandler);
app.openapi(adminStatsRoute, adminStatsHandler);
app.openapi(adminTestSendRoute, adminTestSendHandler);

export default app;
