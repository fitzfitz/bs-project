import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  plSummaryRoute,
  plSummaryHandler,
  voidDiscountRoute,
  voidDiscountHandler,
  payrollOversightRoute,
  payrollOversightHandler,
  taxSummaryRoute,
  taxSummaryHandler,
} from "./finance.handlers";

const financeApp = new OpenAPIHono<AppEnv>();

financeApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("FINANCE_REPORTS", "read"));

financeApp.openapi(plSummaryRoute, plSummaryHandler);
financeApp.openapi(payrollOversightRoute, payrollOversightHandler);
financeApp.openapi(taxSummaryRoute, taxSummaryHandler);
financeApp.openapi(voidDiscountRoute, voidDiscountHandler);

export default financeApp;
