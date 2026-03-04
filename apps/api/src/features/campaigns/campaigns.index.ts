import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listRoute, listHandler,
  createRoute_, createHandler,
  updateRoute, updateHandler,
  sendRoute, sendHandler,
  deleteRoute, deleteHandler,
} from "./campaigns.handlers";

const campaignsApp = new OpenAPIHono<AppEnv>();

const managerRoutes = new OpenAPIHono<AppEnv>();
managerRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("CAMPAIGNS", "read"));
managerRoutes.openapi(listRoute, listHandler);
managerRoutes.openapi(createRoute_, createHandler);
managerRoutes.openapi(updateRoute, updateHandler);
managerRoutes.openapi(sendRoute, sendHandler);

const adminRoutes = new OpenAPIHono<AppEnv>();
adminRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("CAMPAIGNS", "delete"));
adminRoutes.openapi(deleteRoute, deleteHandler);

campaignsApp.route("/", managerRoutes);
campaignsApp.route("/", adminRoutes);

export default campaignsApp;
