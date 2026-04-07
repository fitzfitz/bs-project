import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  createTransactionRoute,
  createHandler,
  addPaymentsRoute,
  addPaymentsHandler,
  voidRoute,
  voidHandler,
  refundRoute,
  refundHandler,
  listRoute,
  listHandler,
  getSummaryRoute,
  getSummaryHandler,
  getByIdRoute,
  getByIdHandler,
  getReceiptRoute,
  getReceiptHandler,
} from "./transactions.handlers";

const transactionsApp = new OpenAPIHono<AppEnv>();
 
transactionsApp.use("*", authMiddleware(), orgScopeMiddleware());

// Read endpoints
transactionsApp.use(listRoute.path, requirePermission("TRANSACTION", "read"));
transactionsApp.openapi(listRoute, listHandler);

transactionsApp.use(getSummaryRoute.path, requirePermission("TRANSACTION", "read"));
transactionsApp.openapi(getSummaryRoute, getSummaryHandler);

transactionsApp.openapi(getByIdRoute, getByIdHandler);
 
transactionsApp.openapi(getReceiptRoute, getReceiptHandler);

// Create endpoints
transactionsApp.use(createTransactionRoute.path, requirePermission("TRANSACTION", "create"));
transactionsApp.openapi(createTransactionRoute, createHandler);

transactionsApp.use("/:id/pay", requirePermission("TRANSACTION", "create"));
transactionsApp.openapi(addPaymentsRoute, addPaymentsHandler);

// Void endpoint
transactionsApp.use("/:id/void", requirePermission("TRANSACTION", "delete"));
transactionsApp.openapi(voidRoute, voidHandler);

// Refund endpoint
transactionsApp.use("/:id/refund", requirePermission("TRANSACTION", "delete"));
transactionsApp.openapi(refundRoute, refundHandler);

export default transactionsApp;
