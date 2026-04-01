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
  revenueTrendQuery,
  globalDashboardSuccessSchema,
  branchComparisonSuccessSchema,
  peakHeatmapSuccessSchema,
  retentionSuccessSchema,
  revenueForecastSuccessSchema,
  utilizationSuccessSchema,
  computeSnapshotsSuccessSchema,
  revenueTrendSuccessSchema,
} from "./analytics.schema";

export const globalDashboardRoute = createRoute({
  method: "get",
  path: "/dashboard",
  request: { query: globalDashboardQuery },
  responses: {
    200: {
      description: "Global dashboard data",
      content: { "application/json": { schema: globalDashboardSuccessSchema } },
    },
  },
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
  responses: {
    200: {
      description: "Branch comparison data",
      content: { "application/json": { schema: branchComparisonSuccessSchema } },
    },
  },
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
  responses: {
    200: {
      description: "Peak hour heatmap",
      content: { "application/json": { schema: peakHeatmapSuccessSchema } },
    },
  },
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
  responses: {
    200: {
      description: "Retention cohort data",
      content: { "application/json": { schema: retentionSuccessSchema } },
    },
  },
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
  responses: {
    200: {
      description: "Revenue forecast",
      content: { "application/json": { schema: revenueForecastSuccessSchema } },
    },
  },
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
  responses: {
    200: {
      description: "Barber utilization data",
      content: { "application/json": { schema: utilizationSuccessSchema } },
    },
  },
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
  responses: {
    200: {
      description: "Snapshots computed",
      content: { "application/json": { schema: computeSnapshotsSuccessSchema } },
    },
  },
  tags: ["Analytics"],
});

export const computeSnapshotsHandler: RouteHandler<typeof computeSnapshotsRoute, AppEnv> = async (c) => {
  const { date } = c.req.valid("json");
  const data = await AnalyticsService.computeDailySnapshots(c.var.db, date);
  return c.json({ success: true, data }, 200);
};

export const revenueTrendRoute = createRoute({
  method: "get",
  path: "/revenue-trend",
  request: { query: revenueTrendQuery },
  responses: {
    200: {
      description: "Daily revenue trend",
      content: { "application/json": { schema: revenueTrendSuccessSchema } },
    },
  },
  tags: ["Analytics"],
});

export const revenueTrendHandler: RouteHandler<typeof revenueTrendRoute, AppEnv> = async (c) => {
  const { branchId, days } = c.req.valid("query");
  const orgId = c.get("organizationId") as string;
  const db = c.var.db;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const where: Record<string, unknown> = {
    organizationId: orgId,
    status: "COMPLETED",
    createdAt: { gte: startDate },
  };
  if (branchId) where.branchId = branchId;

  const transactions = await db.transaction.findMany({
    where,
    select: { createdAt: true, netAmount: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, { revenue: number; transactions: number }>();
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { revenue: 0, transactions: 0 });
  }

  for (const tx of transactions) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += Number(tx.netAmount);
      bucket.transactions += 1;
    }
  }

  const data = [...buckets.entries()].map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue),
    transactions: v.transactions,
  }));

  return c.json({ success: true as const, data }, 200);
};

// --- Schedule Suggestion Routes ---

export const scheduleSuggestionsRoute = createRoute({
  method: "get",
  path: "/schedule-suggestions",
  tags: ["Analytics"],
  summary: "Get scheduling suggestions",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ branchId: z.string(), weekStart: z.string().optional() }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Suggestions" },
  },
});

export const scheduleSuggestionsHandler: RouteHandler<typeof scheduleSuggestionsRoute, AppEnv> = async (c) => {
  const { branchId, weekStart } = c.req.valid("query");
  const { SchedulingService } = await import("./scheduling.service");
  const data = await SchedulingService.getSuggestions(c.var.db, branchId, weekStart);
  return c.json({ success: true, data }, 200);
};

export const computeSuggestionsRoute = createRoute({
  method: "post",
  path: "/schedule-suggestions/compute",
  tags: ["Analytics"],
  summary: "Compute scheduling suggestions",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: z.object({ branchId: z.string() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Result" },
  },
});

export const computeSuggestionsHandler: RouteHandler<typeof computeSuggestionsRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("json");
  const { SchedulingService } = await import("./scheduling.service");
  const orgId = c.get("organizationId")!;
  const data = await SchedulingService.computeSuggestions(c.var.db, branchId, orgId);
  return c.json({ success: true, data }, 200);
};

export const updateSuggestionRoute = createRoute({
  method: "patch",
  path: "/schedule-suggestions/{id}",
  tags: ["Analytics"],
  summary: "Accept or reject a suggestion",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": { schema: z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) }) },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Updated" },
  },
});

export const updateSuggestionHandler: RouteHandler<typeof updateSuggestionRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { status } = c.req.valid("json");
  const { SchedulingService } = await import("./scheduling.service");
  const data = await SchedulingService.updateSuggestion(c.var.db, id, status);
  return c.json({ success: true, data }, 200);
};

// --- Churn Score Routes ---

export const churnScoresRoute = createRoute({
  method: "get",
  path: "/churn-scores",
  tags: ["Analytics"],
  summary: "Get churn risk scores",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      branchId: z.string(),
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      minScore: z.coerce.number().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Churn scores" },
  },
});

export const churnScoresHandler: RouteHandler<typeof churnScoresRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { ChurnService } = await import("./churn.service");
  const result = await ChurnService.getChurnScores(c.var.db, query.branchId, {
    riskLevel: query.riskLevel,
    minScore: query.minScore,
    page: query.page,
    limit: query.limit,
  });
  return c.json({ success: true, ...result }, 200);
};

export const computeChurnRoute = createRoute({
  method: "post",
  path: "/churn-scores/compute",
  tags: ["Analytics"],
  summary: "Compute churn scores for a branch",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: z.object({ branchId: z.string() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Compute result" },
  },
});

export const computeChurnHandler: RouteHandler<typeof computeChurnRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("json");
  const { ChurnService } = await import("./churn.service");
  const orgId = c.get("organizationId")!;
  const data = await ChurnService.computeChurnScores(c.var.db, branchId, orgId);
  return c.json({ success: true, data }, 200);
};

export const customerChurnRoute = createRoute({
  method: "get",
  path: "/churn-scores/{customerId}",
  tags: ["Analytics"],
  summary: "Get single customer churn score",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ customerId: z.string() }),
    query: z.object({ branchId: z.string() }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Churn score" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Not found" },
  },
});

export const customerChurnHandler: RouteHandler<typeof customerChurnRoute, AppEnv> = async (c) => {
  const { customerId } = c.req.valid("param");
  const { branchId } = c.req.valid("query");
  const { ChurnService } = await import("./churn.service");
  const data = await ChurnService.getCustomerChurnScore(c.var.db, customerId, branchId);
  if (!data) return c.json({ success: false, message: "Churn score not found" }, 404);
  return c.json({ success: true, data }, 200);
};
// --- Demand Forecast Routes ---

export const demandForecastRoute = createRoute({
  method: "get",
  path: "/demand-forecast",
  tags: ["Analytics"],
  summary: "Get demand forecasts",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      branchId: z.string(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.any() } },
      description: "Forecast data",
    },
  },
});

export const demandForecastHandler: RouteHandler<typeof demandForecastRoute, AppEnv> = async (c) => {
  const { branchId, dateFrom, dateTo } = c.req.valid("query");
  const { ForecastService } = await import("./forecast.service");
  const data = await ForecastService.getForecasts(c.var.db, branchId, dateFrom, dateTo);
  return c.json({ success: true, data }, 200);
};

export const computeForecastRoute = createRoute({
  method: "post",
  path: "/demand-forecast/compute",
  tags: ["Analytics"],
  summary: "Compute demand forecasts",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: z.object({ branchId: z.string().optional() }) },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.any() } },
      description: "Compute result",
    },
  },
});

export const computeForecastHandler: RouteHandler<typeof computeForecastRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("json");
  const { ForecastService } = await import("./forecast.service");
  const orgId = c.get("organizationId")!;

  if (branchId) {
    const result = await ForecastService.computeForecasts(c.var.db, branchId, orgId);
    return c.json(
      { success: true, data: { branchesProcessed: 1, forecastDays: result.forecastDays } },
      200,
    );
  }

  const result = await ForecastService.computeAllBranches(c.var.db);
  return c.json({ success: true, data: result }, 200);
};
