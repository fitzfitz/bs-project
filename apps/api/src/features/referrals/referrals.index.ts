import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  getMyCodeRoute, getMyCodeHandler,
  applyRoute, applyHandler,
  historyRoute, historyHandler,
  statsRoute, statsHandler,
} from "./referrals.handlers";

const referralsApp = new OpenAPIHono<AppEnv>();

const customerRoutes = new OpenAPIHono<AppEnv>();
customerRoutes.use("*", authMiddleware(), orgScopeMiddleware());
customerRoutes.openapi(getMyCodeRoute, getMyCodeHandler);
customerRoutes.openapi(applyRoute, applyHandler);
customerRoutes.openapi(historyRoute, historyHandler);

const adminRoutes = new OpenAPIHono<AppEnv>();
adminRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("REFERRALS", "read"));
adminRoutes.openapi(statsRoute, statsHandler);

referralsApp.route("/", customerRoutes);
referralsApp.route("/", adminRoutes);

export default referralsApp;
