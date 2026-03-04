import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  customerInsightsSchema,
  listCustomersQuery,
  segmentSchema,
  recomputeSegmentsSchema,
} from "./crm.schema";
import { CrmService } from "./crm.service";

// ─── GET /customers ─────────────────────────────────────────────────────────

export const listCustomersRoute = createRoute({
  method: "get",
  path: "/customers",
  tags: ["CRM"],
  summary: "List branch customers with insights",
  request: { query: listCustomersQuery },
  responses: {
    200: {
      description: "Customer list",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(customerInsightsSchema),
            pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
          }),
        },
      },
    },
  },
});

export const listCustomersHandler: RouteHandler<typeof listCustomersRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const result = await CrmService.listBranchCustomers(c.var.db, query.branchId, {
    segment: query.segment,
    minVisits: query.minVisits,
    sortBy: query.sortBy,
    page: query.page,
    limit: query.limit,
  });
  return c.json({
    success: true as const,
    data: result.data,
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  }, 200);
};

// ─── GET /customers/:id ─────────────────────────────────────────────────────

export const getCustomerRoute = createRoute({
  method: "get",
  path: "/customers/:id",
  tags: ["CRM"],
  summary: "Get customer insights for a specific customer",
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({ branchId: z.string() }),
  },
  responses: {
    200: {
      description: "Customer insights",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: customerInsightsSchema }) } },
    },
  },
});

export const getCustomerHandler: RouteHandler<typeof getCustomerRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { branchId } = c.req.valid("query");
  const insights = await CrmService.getCustomerInsights(c.var.db, branchId, id);
  return c.json({ success: true as const, data: insights }, 200);
};

// ─── GET /segments ──────────────────────────────────────────────────────────

export const listSegmentsRoute = createRoute({
  method: "get",
  path: "/segments",
  tags: ["CRM"],
  summary: "List customer segments for a branch",
  request: { query: z.object({ branchId: z.string() }) },
  responses: {
    200: {
      description: "Segment list",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.array(segmentSchema) }),
        },
      },
    },
  },
});

export const listSegmentsHandler: RouteHandler<typeof listSegmentsRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("query");
  const segments = await CrmService.listSegments(c.var.db, branchId);
  return c.json({ success: true as const, data: segments }, 200);
};

// ─── POST /segments/recompute ───────────────────────────────────────────────

export const recomputeRoute = createRoute({
  method: "post",
  path: "/segments/recompute",
  tags: ["CRM"],
  summary: "Recompute auto-segments for a branch",
  request: {
    body: { content: { "application/json": { schema: recomputeSegmentsSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Recompute result",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ segmentsProcessed: z.number(), totalAssigned: z.number() }),
          }),
        },
      },
    },
  },
});

export const recomputeHandler: RouteHandler<typeof recomputeRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("json");
  const result = await CrmService.recomputeSegments(c.var.db, branchId, c.get("organizationId")!);
  return c.json({ success: true as const, data: result }, 200);
};
