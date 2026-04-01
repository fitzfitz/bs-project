import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission, requireCustomer } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listQueueRoute,
  listQueueHandler,
  getEntryRoute,
  getEntryHandler,
  createEntryRoute,
  createEntryHandler,
  updateStatusRoute,
  updateStatusHandler,
  assignStaffRoute,
  assignStaffHandler,
  postponeEntryRoute,
  postponeEntryHandler,
  cancelEntryRoute,
  cancelEntryHandler,
  customerCancelRoute,
  customerCancelHandler,
  prepayRoute,
  prepayHandler,
  rescheduleRoute,
  rescheduleHandler,
  meQueueRoute,
  meQueueHandler,
  availabilityRoute,
  availabilityHandler,
} from "./queue.handlers";

const queueApp = new OpenAPIHono<AppEnv>();

// Public (no auth)
queueApp.openapi(availabilityRoute, availabilityHandler);

// Authenticated read — any logged-in user
queueApp.use("/me", authMiddleware(), orgScopeMiddleware());
queueApp.openapi(meQueueRoute, meQueueHandler);

queueApp.use("/", authMiddleware(), orgScopeMiddleware());
queueApp.openapi(listQueueRoute, listQueueHandler);

queueApp.use("/:id/prepay", authMiddleware(), requireCustomer());
queueApp.openapi(prepayRoute, prepayHandler);

queueApp.use("/:id", authMiddleware(), orgScopeMiddleware());
queueApp.openapi(getEntryRoute, getEntryHandler);

// Create — any authenticated user (customers + staff)
queueApp.use("/", authMiddleware(), orgScopeMiddleware());
queueApp.openapi(createEntryRoute, createEntryHandler);

// Customer self-service (handler validates ownership)
queueApp.use("/:id/customer-cancel", authMiddleware(), orgScopeMiddleware());
queueApp.openapi(customerCancelRoute, customerCancelHandler);

queueApp.use("/:id/reschedule", authMiddleware(), orgScopeMiddleware());
queueApp.openapi(rescheduleRoute, rescheduleHandler);

// Status transitions — staff with queue permission
queueApp.use("/:id/status", authMiddleware(), orgScopeMiddleware(), requirePermission("QUEUE_MANAGEMENT", "update"));
queueApp.openapi(updateStatusRoute, updateStatusHandler);

// Ops & adjustments — staff with queue permission
queueApp.use("/:id/assign", authMiddleware(), orgScopeMiddleware(), requirePermission("QUEUE_MANAGEMENT", "update"));
queueApp.openapi(assignStaffRoute, assignStaffHandler);

queueApp.use("/:id/postpone", authMiddleware(), orgScopeMiddleware(), requirePermission("QUEUE_MANAGEMENT", "update"));
queueApp.openapi(postponeEntryRoute, postponeEntryHandler);

queueApp.use("/:id/cancel", authMiddleware(), orgScopeMiddleware(), requirePermission("QUEUE_MANAGEMENT", "delete"));
queueApp.openapi(cancelEntryRoute, cancelEntryHandler);

export default queueApp;
