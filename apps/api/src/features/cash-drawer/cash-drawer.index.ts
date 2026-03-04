import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  openSessionRoute,
  openSessionHandler,
  getCurrentSessionRoute,
  getCurrentSessionHandler,
  closeSessionRoute,
  closeSessionHandler,
  addEntryRoute,
  addEntryHandler,
} from "./cash-drawer.handlers";

const cashDrawerApp = new OpenAPIHono<AppEnv>();

const cashDrawerRoutes = new OpenAPIHono<AppEnv>();
cashDrawerRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("CASH_DRAWER", "create"));
cashDrawerRoutes.openapi(openSessionRoute, openSessionHandler);
cashDrawerRoutes.openapi(getCurrentSessionRoute, getCurrentSessionHandler);
cashDrawerRoutes.openapi(closeSessionRoute, closeSessionHandler);
cashDrawerRoutes.openapi(addEntryRoute, addEntryHandler);

cashDrawerApp.route("/", cashDrawerRoutes);

export default cashDrawerApp;
