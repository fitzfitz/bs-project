import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission, requireStaff } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  calculateRoute,
  calculateHandler,
  recalculateRoute,
  recalculateHandler,
  listEarningsRoute,
  listEarningsHandler,
  getMeRoute,
  getMeHandler,
  getByStaffProfileIdRoute,
  getByStaffProfileIdHandler,
} from "./commissions.handlers";

const commissionsApp = new OpenAPIHono<AppEnv>();

// Staff self-service — service providers view their own
commissionsApp.use("/me", authMiddleware(), orgScopeMiddleware(), requireStaff());
commissionsApp.openapi(getMeRoute, getMeHandler);

// Manager operations
commissionsApp.use("/calculate", authMiddleware(), orgScopeMiddleware(), requirePermission("COMMISSION", "create"));
commissionsApp.openapi(calculateRoute, calculateHandler);

commissionsApp.use("/recalculate", authMiddleware(), orgScopeMiddleware(), requirePermission("COMMISSION", "update"));
commissionsApp.openapi(recalculateRoute, recalculateHandler);

commissionsApp.use("/", authMiddleware(), orgScopeMiddleware(), requirePermission("COMMISSION", "read"));
commissionsApp.openapi(listEarningsRoute, listEarningsHandler);

commissionsApp.use("/:staffProfileId", authMiddleware(), orgScopeMiddleware(), requirePermission("COMMISSION", "read"));
commissionsApp.openapi(getByStaffProfileIdRoute, getByStaffProfileIdHandler);

export default commissionsApp;
