import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listLogsRoute,
  listLogsHandler,
  listAnomaliesRoute,
  listAnomaliesHandler,
  anomalyStatsRoute,
  anomalyStatsHandler,
  resolveAnomalyRoute,
  resolveAnomalyHandler,
} from "./audit.handlers";

const auditApp = new OpenAPIHono<AppEnv>();

const protectedApp = new OpenAPIHono<AppEnv>();
protectedApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("AUDIT_LOG", "read"));
protectedApp.openapi(listLogsRoute, listLogsHandler);
protectedApp.openapi(listAnomaliesRoute, listAnomaliesHandler);
protectedApp.openapi(anomalyStatsRoute, anomalyStatsHandler);
protectedApp.openapi(resolveAnomalyRoute, resolveAnomalyHandler);

auditApp.route("/", protectedApp);

export default auditApp;
