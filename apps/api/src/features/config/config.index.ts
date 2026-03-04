import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listConfigRoute,
  listConfigHandler,
  updateConfigRoute,
  updateConfigHandler,
} from "./config.handlers";

const configApp = new OpenAPIHono<AppEnv>();

const protectedApp = new OpenAPIHono<AppEnv>();
protectedApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("ORG_SETTINGS", "read"));
protectedApp.openapi(listConfigRoute, listConfigHandler);

const writeApp = new OpenAPIHono<AppEnv>();
writeApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("ORG_SETTINGS", "update"));
writeApp.openapi(updateConfigRoute, updateConfigHandler);

configApp.route("/", protectedApp);
configApp.route("/", writeApp);

export default configApp;
