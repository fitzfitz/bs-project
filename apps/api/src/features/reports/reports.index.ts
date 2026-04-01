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
  exportPdfRoute,
  exportPdfHandler,
  listSchedulesRoute,
  listSchedulesHandler,
  createScheduleRoute,
  createScheduleHandler,
  updateScheduleRoute,
  updateScheduleHandler,
  deleteScheduleRoute,
  deleteScheduleHandler,
  listTemplatesRoute,
  listTemplatesHandler,
  createTemplateRoute,
  createTemplateHandler,
  deleteTemplateRoute,
  deleteTemplateHandler,
} from "./reports.handlers";

const reportsApp = new OpenAPIHono<AppEnv>();

// Read (method-specific paths share /schedules and /templates with mutating routes)
reportsApp.on(
  "GET",
  generateReportRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "read"),
  (c, next) => next(),
);
reportsApp.openapi(generateReportRoute, generateReportHandler);

reportsApp.on(
  "GET",
  exportCsvRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "read"),
  (c, next) => next(),
);
reportsApp.openapi(exportCsvRoute, exportCsvHandler);

reportsApp.on(
  "GET",
  exportPdfRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "read"),
  (c, next) => next(),
);
reportsApp.openapi(exportPdfRoute, exportPdfHandler);

reportsApp.on(
  "GET",
  listSchedulesRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "read"),
  (c, next) => next(),
);
reportsApp.openapi(listSchedulesRoute, listSchedulesHandler);

reportsApp.on(
  "GET",
  listTemplatesRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "read"),
  (c, next) => next(),
);
reportsApp.openapi(listTemplatesRoute, listTemplatesHandler);

reportsApp.on(
  "POST",
  createScheduleRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "create"),
  (c, next) => next(),
);
reportsApp.openapi(createScheduleRoute, createScheduleHandler);

reportsApp.on(
  "PATCH",
  "/schedules/:id",
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "update"),
  (c, next) => next(),
);
reportsApp.openapi(updateScheduleRoute, updateScheduleHandler);

reportsApp.on(
  "DELETE",
  "/schedules/:id",
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "delete"),
  (c, next) => next(),
);
reportsApp.openapi(deleteScheduleRoute, deleteScheduleHandler);

reportsApp.on(
  "POST",
  createTemplateRoute.path,
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "create"),
  (c, next) => next(),
);
reportsApp.openapi(createTemplateRoute, createTemplateHandler);

reportsApp.on(
  "DELETE",
  "/templates/:id",
  authMiddleware(),
  orgScopeMiddleware(),
  requirePermission("REPORTS", "delete"),
  (c, next) => next(),
);
reportsApp.openapi(deleteTemplateRoute, deleteTemplateHandler);

export default reportsApp;
