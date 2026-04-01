import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  webhookRoute, webhookHandler,
  createChargeRoute, createChargeHandler,
  listMethodsRoute, listMethodsHandler,
  saveMethodRoute, saveMethodHandler,
  deleteMethodRoute, deleteMethodHandler,
} from "./payments.handlers";
import { authMiddleware } from "../../middlewares/auth";
import { orgScopeMiddleware } from "../../middlewares/scope";
import { requirePermission } from "../../middlewares/rbac";

const paymentsApp = new OpenAPIHono<AppEnv>();

paymentsApp.use("/create-charge", authMiddleware(), orgScopeMiddleware(), requirePermission("TRANSACTION", "create"));
paymentsApp.openapi(createChargeRoute, createChargeHandler);

paymentsApp.openapi(webhookRoute, webhookHandler);

paymentsApp.use("/methods", authMiddleware(), orgScopeMiddleware());
paymentsApp.use("/methods/*", authMiddleware(), orgScopeMiddleware());
paymentsApp.openapi(listMethodsRoute, listMethodsHandler);
paymentsApp.openapi(saveMethodRoute, saveMethodHandler);
paymentsApp.openapi(deleteMethodRoute, deleteMethodHandler);

export default paymentsApp;
