import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  generateReportRoute,
  generateReportHandler,
  exportCsvRoute,
  exportCsvHandler,
} from "./reports.handlers";

const reportsApp = new OpenAPIHono<AppEnv>();

const protectedApp = new OpenAPIHono<AppEnv>();
protectedApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("REPORTS", "read"));
protectedApp.openapi(generateReportRoute, generateReportHandler);
protectedApp.openapi(exportCsvRoute, exportCsvHandler);

reportsApp.route("/", protectedApp);

export default reportsApp;
