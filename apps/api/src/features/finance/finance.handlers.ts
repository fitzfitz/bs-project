import { createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";
import { FinanceService } from "./finance.service";
import { plSummaryQuery, voidDiscountAuditQuery, payrollOversightQuery, taxSummaryQuery } from "./finance.schema";

const jsonRes = z.object({ success: z.boolean(), data: z.any() });

export const plSummaryRoute = createRoute({
  method: "get",
  path: "/pl",
  request: { query: plSummaryQuery },
  responses: { 200: { description: "P&L summary", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Finance"],
});

export const plSummaryHandler: RouteHandler<typeof plSummaryRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await FinanceService.getPLSummary(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const voidDiscountRoute = createRoute({
  method: "get",
  path: "/void-discount-audit",
  request: { query: voidDiscountAuditQuery },
  responses: { 200: { description: "Void/discount audit", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Finance"],
});

export const voidDiscountHandler: RouteHandler<typeof voidDiscountRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await FinanceService.getVoidDiscountAudit(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const payrollOversightRoute = createRoute({
  method: "get",
  path: "/payroll-oversight",
  request: { query: payrollOversightQuery },
  responses: { 200: { description: "Payroll oversight", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Finance"],
});

export const payrollOversightHandler: RouteHandler<typeof payrollOversightRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await FinanceService.getPayrollOversight(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const taxSummaryRoute = createRoute({
  method: "get",
  path: "/tax-summary",
  request: { query: taxSummaryQuery },
  responses: { 200: { description: "Tax summary", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Finance"],
});

export const taxSummaryHandler: RouteHandler<typeof taxSummaryRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await FinanceService.getTaxSummary(c.var.db, query);
  return c.json({ success: true, data }, 200);
};
