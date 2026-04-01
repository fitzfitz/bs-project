import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission, requireStaff } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listStaffRoute,
  listStaffHandler,
  getStaffRoute,
  getStaffHandler,
  createStaffRoute,
  createStaffHandler,
  updateStaffRoute,
  updateStaffHandler,
  deleteStaffRoute,
  deleteStaffHandler,
  assignToBranchRoute,
  assignToBranchHandler,
  removeFromBranchRoute,
  removeFromBranchHandler,
  updateAvatarRoute,
  updateAvatarHandler,
  resetCommissionRoute,
  resetCommissionHandler,
  updateStatusRoute,
  updateStatusHandler,
} from "./staff.handlers";

const staffApp = new OpenAPIHono<AppEnv>();

// Public — anyone can browse staff profiles
staffApp.openapi(listStaffRoute, listStaffHandler);
staffApp.openapi(getStaffRoute, getStaffHandler);

// Admin — profile management
staffApp.on("POST", createStaffRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "create"), (c, next) => next());
staffApp.openapi(createStaffRoute, createStaffHandler);

staffApp.on("PATCH", updateStaffRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "update"), (c, next) => next());
staffApp.openapi(updateStaffRoute, updateStaffHandler);

staffApp.on("POST", assignToBranchRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "update"), (c, next) => next());
staffApp.openapi(assignToBranchRoute, assignToBranchHandler);

staffApp.on("DELETE", removeFromBranchRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "update"), (c, next) => next());
staffApp.openapi(removeFromBranchRoute, removeFromBranchHandler);

staffApp.on("DELETE", deleteStaffRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "delete"), (c, next) => next());
staffApp.openapi(deleteStaffRoute, deleteStaffHandler);

// Avatar update
staffApp.on("PATCH", updateAvatarRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "update"), (c, next) => next());
staffApp.openapi(updateAvatarRoute, updateAvatarHandler);

// Reset commission to template
staffApp.on("POST", resetCommissionRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("STAFF_MANAGEMENT", "update"), (c, next) => next());
staffApp.openapi(resetCommissionRoute, resetCommissionHandler);

// Status update — service providers can update their own status
staffApp.on("PATCH", updateStatusRoute.path, authMiddleware(), orgScopeMiddleware(), requireStaff(), (c, next) => next());
staffApp.openapi(updateStatusRoute, updateStatusHandler);

export default staffApp;
