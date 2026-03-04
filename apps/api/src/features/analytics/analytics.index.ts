import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  globalDashboardRoute,
  globalDashboardHandler,
  branchComparisonRoute,
  branchComparisonHandler,
  peakHeatmapRoute,
  peakHeatmapHandler,
  retentionRoute,
  retentionHandler,
  forecastRoute,
  forecastHandler,
  computeSnapshotsRoute,
  computeSnapshotsHandler,
} from "./analytics.handlers";

const analyticsApp = new OpenAPIHono<AppEnv>();

analyticsApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("ANALYTICS", "read"));

analyticsApp.openapi(peakHeatmapRoute, peakHeatmapHandler);
analyticsApp.openapi(globalDashboardRoute, globalDashboardHandler);
analyticsApp.openapi(branchComparisonRoute, branchComparisonHandler);
analyticsApp.openapi(retentionRoute, retentionHandler);
analyticsApp.openapi(forecastRoute, forecastHandler);
analyticsApp.openapi(computeSnapshotsRoute, computeSnapshotsHandler);

export default analyticsApp;
