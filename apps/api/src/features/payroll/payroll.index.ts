import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  generateRoute,
  generateHandler,
  listRoute,
  listHandler,
  getByIdRoute,
  getByIdHandler,
  submitRoute,
  submitHandler,
  approveRoute,
  approveHandler,
  disputeRoute,
  disputeHandler,
  resolveRoute,
  resolveHandler,
  disburseRoute,
  disburseHandler,
} from "./payroll.handlers";

const payrollApp = new OpenAPIHono<AppEnv>();

// Read
payrollApp.use("/", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "read"));
payrollApp.openapi(listRoute, listHandler);

payrollApp.use("/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "read"));
payrollApp.openapi(getByIdRoute, getByIdHandler);

// Manager operations
payrollApp.use("/generate", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "create"));
payrollApp.openapi(generateRoute, generateHandler);

payrollApp.use("/:id/submit", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "update"));
payrollApp.openapi(submitRoute, submitHandler);

payrollApp.use("/:id/approve", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "update"));
payrollApp.openapi(approveRoute, approveHandler);

payrollApp.use("/:id/resolve", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "update"));
payrollApp.openapi(resolveRoute, resolveHandler);

// Staff can dispute their own payroll
payrollApp.use("/:id/dispute", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "update"));
payrollApp.openapi(disputeRoute, disputeHandler);

// Disburse
payrollApp.use("/:id/disburse", authMiddleware(), orgScopeMiddleware(), requirePermission("PAYROLL", "update"));
payrollApp.openapi(disburseRoute, disburseHandler);

export default payrollApp;
