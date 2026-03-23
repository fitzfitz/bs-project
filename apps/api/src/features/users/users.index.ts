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

usersApp.use("*", authMiddleware(), orgScopeMiddleware());

const readApp = new OpenAPIHono<AppEnv>();
readApp.use("*", requirePermission("USER_MANAGEMENT", "read"));
readApp.openapi(listUsersRoute, listUsersHandler);
readApp.openapi(getUserRoute, getUserHandler);

const updateApp = new OpenAPIHono<AppEnv>();
updateApp.use("*", requirePermission("USER_MANAGEMENT", "update"));
updateApp.openapi(updateRoleRoute, updateRoleHandler);
updateApp.openapi(assignBranchRoute, assignBranchHandler);
updateApp.openapi(removeBranchRoute, removeBranchHandler);
updateApp.openapi(deactivateUserRoute, deactivateUserHandler);
updateApp.openapi(reactivateUserRoute, reactivateUserHandler);

usersApp.route("/", readApp);
usersApp.route("/", updateApp);

export default usersApp;
