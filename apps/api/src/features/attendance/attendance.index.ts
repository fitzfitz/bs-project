import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listAttendanceRoute,
  listAttendanceHandler,
  clockInRoute,
  clockInHandler,
  clockOutRoute,
  clockOutHandler,
  listShiftsRoute,
  listShiftsHandler,
  createShiftBlockRoute,
  createShiftBlockHandler,
  updateShiftBlockRoute,
  updateShiftBlockHandler,
  deleteShiftBlockRoute,
  deleteShiftBlockHandler,
} from "./attendance.handlers";

const attendanceApp = new OpenAPIHono<AppEnv>();

// View attendance
attendanceApp.use("/", authMiddleware(), orgScopeMiddleware(), requirePermission("ATTENDANCE", "read"));
attendanceApp.openapi(listAttendanceRoute, listAttendanceHandler);

// Clock in/out — staff with attendance permission
attendanceApp.use("/clock-in", authMiddleware(), orgScopeMiddleware(), requirePermission("ATTENDANCE", "create"));
attendanceApp.openapi(clockInRoute, clockInHandler);

attendanceApp.use("/:id/clock-out", authMiddleware(), orgScopeMiddleware(), requirePermission("ATTENDANCE", "update"));
attendanceApp.openapi(clockOutRoute, clockOutHandler);

// View shifts — any authenticated user
attendanceApp.use("/shifts", authMiddleware(), orgScopeMiddleware());
attendanceApp.openapi(listShiftsRoute, listShiftsHandler);

// Manage shifts
attendanceApp.use("/shifts", authMiddleware(), orgScopeMiddleware(), requirePermission("ATTENDANCE", "create"));
attendanceApp.openapi(createShiftBlockRoute, createShiftBlockHandler);

attendanceApp.use("/shifts/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("ATTENDANCE", "update"));
attendanceApp.openapi(updateShiftBlockRoute, updateShiftBlockHandler);

attendanceApp.use("/shifts/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("ATTENDANCE", "delete"));
attendanceApp.openapi(deleteShiftBlockRoute, deleteShiftBlockHandler);

export default attendanceApp;
