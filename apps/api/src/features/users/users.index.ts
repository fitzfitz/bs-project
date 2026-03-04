import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listUsersRoute,
  listUsersHandler,
  getUserRoute,
  getUserHandler,
  updateRoleRoute,
  updateRoleHandler,
  assignBranchRoute,
  assignBranchHandler,
  removeBranchRoute,
  removeBranchHandler,
  deactivateUserRoute,
  deactivateUserHandler,
  reactivateUserRoute,
  reactivateUserHandler,
} from "./users.handlers";

const usersApp = new OpenAPIHono<AppEnv>();

// Read permissions
usersApp.on("GET", listUsersRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "read"), (c, next) => next());
usersApp.openapi(listUsersRoute, listUsersHandler);

usersApp.on("GET", getUserRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "read"), (c, next) => next());
usersApp.openapi(getUserRoute, getUserHandler);

// Update permissions
usersApp.on("PATCH", updateRoleRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "update"), (c, next) => next());
usersApp.openapi(updateRoleRoute, updateRoleHandler);

usersApp.on("POST", assignBranchRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "update"), (c, next) => next());
usersApp.openapi(assignBranchRoute, assignBranchHandler);

usersApp.on("DELETE", removeBranchRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "update"), (c, next) => next());
usersApp.openapi(removeBranchRoute, removeBranchHandler);

usersApp.on("PATCH", deactivateUserRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "update"), (c, next) => next());
usersApp.openapi(deactivateUserRoute, deactivateUserHandler);

usersApp.on("PATCH", reactivateUserRoute.path, authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "update"), (c, next) => next());
usersApp.openapi(reactivateUserRoute, reactivateUserHandler);

export default usersApp;
