import { createRoute, z } from "@hono/zod-openapi";
import {
  anomalyQuery,
  AnomalyFlagResponseSchema,
  AnomalyResolvedSchema,
  AnomalyStatsSchema,
  auditLogQuery,
  AuditLogResponseSchema,
  resolveAnomalySchema,
} from "./audit.schema";
import { AuditService } from "./audit.service";
import {
  createPaginatedSuccessSchema,
  createSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

// ── Route Definitions ───────────────────────────────────────────────

export const listLogsRoute = createRoute({
  method: "get",
  path: "/logs",
  tags: ["Audit"],
  summary: "List audit log entries",
  security: [{ bearerAuth: [] }],
  request: { query: auditLogQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(AuditLogResponseSchema),
        },
      },
      description: "Paginated audit logs",
    },
  },
});

export const listAnomaliesRoute = createRoute({
  method: "get",
  path: "/anomalies",
  tags: ["Audit"],
  summary: "List anomaly flags",
  security: [{ bearerAuth: [] }],
  request: { query: anomalyQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(AnomalyFlagResponseSchema),
        },
      },
      description: "Paginated anomalies",
    },
  },
});

export const anomalyStatsRoute = createRoute({
  method: "get",
  path: "/anomalies/stats",
  tags: ["Audit"],
  summary: "Get anomaly statistics",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ branchId: z.string().optional() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(AnomalyStatsSchema) },
      },
      description: "Anomaly statistics",
    },
  },
});

export const resolveAnomalyRoute = createRoute({
  method: "patch",
  path: "/anomalies/{id}/resolve",
  tags: ["Audit"],
  summary: "Resolve an anomaly flag",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: resolveAnomalySchema } } },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(AnomalyResolvedSchema) },
      },
      description: "Anomaly resolved",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Cannot resolve",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Anomaly not found",
    },
  },
});

// ── Handlers ────────────────────────────────────────────────────────

export const listLogsHandler: RouteHandler<typeof listLogsRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const callerScope = c.get("scope") as string;
  const callerBranchId = c.get("branchId");

  const result = await AuditService.listLogs(c.var.db, {
    ...query,
    page: parseInt(query.page ?? "1", 10),
    limit: parseInt(query.limit ?? "50", 10),
    callerScope,
    callerBranchId,
  });

  return c.json(
    { success: true as const, data: result.logs, pagination: result.pagination },
    200
  );
};

export const listAnomaliesHandler: RouteHandler<typeof listAnomaliesRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const callerScope = c.get("scope") as string;
  const callerBranchId = c.get("branchId");

  const result = await AuditService.listAnomalies(c.var.db, {
    ...query,
    page: parseInt(query.page ?? "1", 10),
    limit: parseInt(query.limit ?? "20", 10),
    callerScope,
    callerBranchId,
  });

  return c.json(
    { success: true as const, data: result.anomalies, pagination: result.pagination },
    200
  );
};

export const anomalyStatsHandler: RouteHandler<typeof anomalyStatsRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("query");
  const stats = await AuditService.getAnomalyStats(c.var.db, branchId);
  return c.json({ success: true as const, data: stats }, 200);
};

export const resolveAnomalyHandler: RouteHandler<typeof resolveAnomalyRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const adminId = c.get("userId") as string;

  try {
    const result = await AuditService.resolveAnomaly(c.var.db, id, adminId, body.notes);
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 400;
    return c.json({ success: false as const, message: err.message }, status);
  }
};
