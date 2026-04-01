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

// Read endpoints
transactionsApp.on("GET", listRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "read"), (c, next) => next());
transactionsApp.openapi(listRoute, listHandler);

transactionsApp.on("GET", getSummaryRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "read"), (c, next) => next());
transactionsApp.openapi(getSummaryRoute, getSummaryHandler);

transactionsApp.on("GET", "/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "read"), (c, next) => next());
transactionsApp.openapi(getByIdRoute, getByIdHandler);

transactionsApp.on("GET", "/:id/receipt", authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "read"), (c, next) => next());
transactionsApp.openapi(getReceiptRoute, getReceiptHandler);

// Create endpoints
transactionsApp.on("POST", createTransactionRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "create"), (c, next) => next());
transactionsApp.openapi(createTransactionRoute, createHandler);

transactionsApp.on("POST", "/:id/pay", authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "create"), (c, next) => next());
transactionsApp.openapi(addPaymentsRoute, addPaymentsHandler);

// Void endpoint
transactionsApp.on("POST", "/:id/void", authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "delete"), (c, next) => next());
transactionsApp.openapi(voidRoute, voidHandler);

// Refund endpoint
transactionsApp.on("POST", "/:id/refund", authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "delete"), (c, next) => next());
transactionsApp.openapi(refundRoute, refundHandler);

export default transactionsApp;
