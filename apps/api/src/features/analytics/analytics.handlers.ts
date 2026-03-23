import { createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";
import { AnalyticsService } from "./analytics.service";
import {
  globalDashboardQuery,
  branchComparisonQuery,
  peakHourQuery,
  retentionQuery,
  forecastQuery,
  computeSnapshotsBody,
  utilizationQuery,
} from "./analytics.schema";

const jsonRes = z.object({ success: z.boolean(), data: z.any() });

export const globalDashboardRoute = createRoute({
  method: "get",
  path: "/dashboard",
  request: { query: globalDashboardQuery },
  responses: { 200: { description: "Global dashboard data", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const globalDashboardHandler: RouteHandler<typeof globalDashboardRoute, AppEnv> = async (c) => {
  const { date } = c.req.valid("query");
  const data = await AnalyticsService.getGlobalDashboard(c.var.db, date);
  return c.json({ success: true, data }, 200);
};

export const branchComparisonRoute = createRoute({
  method: "get",
  path: "/comparison",
  request: { query: branchComparisonQuery },
  responses: { 200: { description: "Branch comparison data", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const branchComparisonHandler: RouteHandler<typeof branchComparisonRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const branchIds = query.branchIds ? query.branchIds.split(",").filter(Boolean) : undefined;
  const data = await AnalyticsService.getBranchComparison(c.var.db, {
    branchIds,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    metric: query.metric,
  });
  return c.json({ success: true, data }, 200);
};

export const peakHeatmapRoute = createRoute({
  method: "get",
  path: "/heatmap",
  request: { query: peakHourQuery },
  responses: { 200: { description: "Peak hour heatmap", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const peakHeatmapHandler: RouteHandler<typeof peakHeatmapRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await AnalyticsService.getPeakHeatmap(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const retentionRoute = createRoute({
  method: "get",
  path: "/retention",
  request: { query: retentionQuery },
  responses: { 200: { description: "Retention cohort data", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const retentionHandler: RouteHandler<typeof retentionRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await AnalyticsService.getRetentionCohort(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const forecastRoute = createRoute({
  method: "get",
  path: "/forecast",
  request: { query: forecastQuery },
  responses: { 200: { description: "Revenue forecast", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const forecastHandler: RouteHandler<typeof forecastRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await AnalyticsService.getRevenueForecast(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const utilizationRoute = createRoute({
  method: "get",
  path: "/utilization",
  request: { query: utilizationQuery },
  responses: { 200: { description: "Barber utilization data", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const utilizationHandler: RouteHandler<typeof utilizationRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await AnalyticsService.getUtilization(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const computeSnapshotsRoute = createRoute({
  method: "post",
  path: "/snapshots/compute",
  request: { body: { content: { "application/json": { schema: computeSnapshotsBody } } } },
  responses: { 200: { description: "Snapshots computed", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Analytics"],
});

export const computeSnapshotsHandler: RouteHandler<typeof computeSnapshotsRoute, AppEnv> = async (c) => {
  const { date } = c.req.valid("json");
  const data = await AnalyticsService.computeDailySnapshots(c.var.db, date);
  return c.json({ success: true, data }, 200);
};
