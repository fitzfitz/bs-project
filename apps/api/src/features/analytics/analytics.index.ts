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
  utilizationRoute,
  utilizationHandler,
  computeSnapshotsRoute,
  computeSnapshotsHandler,
  revenueTrendRoute,
  revenueTrendHandler,
  demandForecastRoute,
  demandForecastHandler,
  computeForecastRoute,
  computeForecastHandler,
  scheduleSuggestionsRoute,
  scheduleSuggestionsHandler,
  computeSuggestionsRoute,
  computeSuggestionsHandler,
  updateSuggestionRoute,
  updateSuggestionHandler,
  churnScoresRoute,
  churnScoresHandler,
  computeChurnRoute,
  computeChurnHandler,
  customerChurnRoute,
  customerChurnHandler,
} from "./analytics.handlers";

const analyticsApp = new OpenAPIHono<AppEnv>();

analyticsApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("ANALYTICS", "read"));

analyticsApp.openapi(peakHeatmapRoute, peakHeatmapHandler);
analyticsApp.openapi(globalDashboardRoute, globalDashboardHandler);
analyticsApp.openapi(branchComparisonRoute, branchComparisonHandler);
analyticsApp.openapi(retentionRoute, retentionHandler);
analyticsApp.openapi(forecastRoute, forecastHandler);
analyticsApp.openapi(utilizationRoute, utilizationHandler);
analyticsApp.openapi(computeSnapshotsRoute, computeSnapshotsHandler);
analyticsApp.openapi(revenueTrendRoute, revenueTrendHandler);
analyticsApp.openapi(demandForecastRoute, demandForecastHandler);
analyticsApp.openapi(computeForecastRoute, computeForecastHandler);
analyticsApp.openapi(scheduleSuggestionsRoute, scheduleSuggestionsHandler);
analyticsApp.openapi(computeSuggestionsRoute, computeSuggestionsHandler);
analyticsApp.openapi(updateSuggestionRoute, updateSuggestionHandler);
analyticsApp.openapi(churnScoresRoute, churnScoresHandler);
analyticsApp.openapi(computeChurnRoute, computeChurnHandler);
analyticsApp.openapi(customerChurnRoute, customerChurnHandler);

export default analyticsApp;
