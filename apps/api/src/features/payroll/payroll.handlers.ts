import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { PayrollService } from "./payroll.service";
import {
  generatePeriodSchema,
  payrollIdParamSchema,
  approveSchema,
  disputeSchema,
  resolveDisputeSchema,
  markDisbursedSchema,
  listPayrollQuerySchema,
  PayrollPeriodSchema,
} from "./payroll.schema";
import { createSuccessSchema, createPaginatedSuccessSchema } from "../../utils/openapi";

const periodResponse = (schema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    data: schema,
  });

export const generateRoute = createRoute({
  method: "post",
  path: "/generate",
  tags: ["Payroll"],
  summary: "Generate payroll period",
  request: { body: { content: { "application/json": { schema: generatePeriodSchema } } } },
  responses: {
    201: {
      description: "Payroll period created",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    400: { description: "Bad request" },
    500: { description: "Internal server error" },
  },
});

export const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Payroll"],
  summary: "List payroll periods",
  request: { query: listPayrollQuerySchema },
  responses: {
    200: {
      description: "Paginated payroll periods",
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(PayrollPeriodSchema),
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const getByIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Payroll"],
  summary: "Get payroll period by ID",
  request: { params: payrollIdParamSchema },
  responses: {
    200: {
      description: "Payroll period",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    404: { description: "Not found" },
    500: { description: "Internal server error" },
  },
});

export const submitRoute = createRoute({
  method: "post",
  path: "/{id}/submit",
  tags: ["Payroll"],
  summary: "Submit for approval",
  request: { params: payrollIdParamSchema },
  responses: {
    200: {
      description: "Submitted",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    400: { description: "Invalid transition" },
    404: { description: "Not found" },
    500: { description: "Internal server error" },
  },
});

export const approveRoute = createRoute({
  method: "post",
  path: "/{id}/approve",
  tags: ["Payroll"],
  summary: "Approve payroll",
  request: {
    params: payrollIdParamSchema,
    body: { content: { "application/json": { schema: approveSchema } } },
  },
  responses: {
    200: {
      description: "Approved",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    400: { description: "Invalid transition" },
    404: { description: "Not found" },
    500: { description: "Internal server error" },
  },
});

export const disputeRoute = createRoute({
  method: "post",
  path: "/{id}/dispute",
  tags: ["Payroll"],
  summary: "Dispute payroll (barber only, own payroll)",
  request: {
    params: payrollIdParamSchema,
    body: { content: { "application/json": { schema: disputeSchema } } },
  },
  responses: {
    200: {
      description: "Disputed",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    400: { description: "Invalid transition" },
    403: { description: "Not your payroll" },
    404: { description: "Not found" },
    500: { description: "Internal server error" },
  },
});

export const resolveRoute = createRoute({
  method: "post",
  path: "/{id}/resolve",
  tags: ["Payroll"],
  summary: "Resolve dispute (manager)",
  request: {
    params: payrollIdParamSchema,
    body: { content: { "application/json": { schema: resolveDisputeSchema } } },
  },
  responses: {
    200: {
      description: "Resolved",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    400: { description: "Invalid transition" },
    404: { description: "Not found" },
    500: { description: "Internal server error" },
  },
});

export const disburseRoute = createRoute({
  method: "post",
  path: "/{id}/disburse",
  tags: ["Payroll"],
  summary: "Mark as disbursed (super admin only)",
  request: {
    params: payrollIdParamSchema,
    body: { content: { "application/json": { schema: markDisbursedSchema } } },
  },
  responses: {
    200: {
      description: "Disbursed",
      content: { "application/json": { schema: periodResponse(PayrollPeriodSchema) } },
    },
    400: { description: "Invalid transition" },
    404: { description: "Not found" },
    500: { description: "Internal server error" },
  },
});

function toPayload(p: { approvedAt: Date | null; approvedBy: string | null; [k: string]: any }) {
  return {
    ...p,
    periodStart: p.periodStart.toISOString?.()?.slice(0, 10) ?? p.periodStart,
    periodEnd: p.periodEnd.toISOString?.()?.slice(0, 10) ?? p.periodEnd,
    approvedAt: p.approvedAt?.toISOString?.() ?? null,
    createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
    updatedAt: p.updatedAt?.toISOString?.() ?? p.updatedAt,
  };
}

export const generateHandler: RouteHandler<typeof generateRoute, AppEnv> = async (c) => {
  try {
    const data = c.req.valid("json");
    const period = await PayrollService.generatePeriod(c.var.db, data);
    return c.json({ success: true as const, data: toPayload(period) }, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return c.json({ success: false, message: msg }, 400);
  }
};

export const listHandler: RouteHandler<typeof listRoute, AppEnv> = async (c) => {
  try {
    let query = c.req.valid("query");
    const scope = c.get("scope");
    if (scope !== "HQ" && c.var.userId && !query.staffProfileId) {
      const staffProfile = await c.var.db.staffProfile.findFirst({
        where: { userId: c.var.userId },
      });
      if (!staffProfile) return c.json({ success: true as const, data: [], pagination: { page: 1, limit: query.limit, total: 0, totalPages: 0 } }, 200);
      query = { ...query, staffProfileId: staffProfile.id };
    }
    const result = await PayrollService.list(c.var.db, query);
    const data = result.items.map(toPayload);
    return c.json({
      success: true as const,
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    }, 200);
  } catch (err) {
    console.error("List payroll:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getByIdHandler: RouteHandler<typeof getByIdRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const period = await PayrollService.getById(c.var.db, id);
    const scope = c.get("scope");
    if (scope !== "HQ" && scope !== "BRANCH" && c.var.userId) {
      await PayrollService.assertBarberOwnsPayroll(c.var.db, period.staffProfileId, c.var.userId);
    }
    return c.json({ success: true as const, data: toPayload(period) }, 200);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Payroll period not found")
      return c.json({ success: false, message: "Payroll period not found" }, 404);
    if (err instanceof Error && err.message.includes("does not belong"))
      return c.json({ success: false, message: err.message }, 403);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const submitHandler: RouteHandler<typeof submitRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const period = await PayrollService.submitForApproval(c.var.db, id);
    return c.json({ success: true as const, data: toPayload(period) }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    return c.json({ success: false, message: msg }, 400);
  }
};

export const approveHandler: RouteHandler<typeof approveRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const { note } = c.req.valid("json");
    const userId = c.var.userId!;
    const organizationId = c.get("organizationId")!;
    const period = await PayrollService.approve(c.var.db, id, userId, organizationId, note);
    return c.json({ success: true as const, data: toPayload(period!) }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    return c.json({ success: false, message: msg }, 400);
  }
};

export const disputeHandler: RouteHandler<typeof disputeRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const { note } = c.req.valid("json");
    const userId = c.var.userId!;
    const organizationId = c.get("organizationId")!;
    const period = await PayrollService.getById(c.var.db, id);
    await PayrollService.assertBarberOwnsPayroll(c.var.db, period.staffProfileId, userId);
    const updated = await PayrollService.dispute(c.var.db, id, userId, organizationId, note);
    return c.json({ success: true as const, data: toPayload(updated) }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    if (msg.includes("does not belong")) return c.json({ success: false, message: msg }, 403);
    return c.json({ success: false, message: msg }, 400);
  }
};

export const resolveHandler: RouteHandler<typeof resolveRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const { note } = c.req.valid("json");
    const period = await PayrollService.resolveDispute(c.var.db, id, note);
    return c.json({ success: true as const, data: toPayload(period) }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    return c.json({ success: false, message: msg }, 400);
  }
};

export const disburseHandler: RouteHandler<typeof disburseRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const { note } = c.req.valid("json");
    const period = await PayrollService.markDisbursed(c.var.db, id, note);
    return c.json({ success: true as const, data: toPayload(period) }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    return c.json({ success: false, message: msg }, 400);
  }
};
