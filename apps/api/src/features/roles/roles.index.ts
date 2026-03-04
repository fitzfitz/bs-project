import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listRolesRoute,
  listRolesHandler,
  createRoleRoute,
  createRoleHandler,
  updateRoleRoute,
  updateRoleHandler,
  deleteRoleRoute,
  deleteRoleHandler,
  getPermissionsRoute,
  getPermissionsHandler,
  setPermissionsRoute,
  setPermissionsHandler,
  getRoleServicesRoute,
  getRoleServicesHandler,
  setRoleServicesRoute,
  setRoleServicesHandler,
} from "./roles.handlers";

const rolesApp = new OpenAPIHono<AppEnv>();

rolesApp.use("*", authMiddleware(), orgScopeMiddleware());

const readApp = new OpenAPIHono<AppEnv>();
readApp.use("*", requirePermission("ROLE_MANAGEMENT", "read"));
readApp.openapi(listRolesRoute, listRolesHandler);
readApp.openapi(getPermissionsRoute, getPermissionsHandler);
readApp.openapi(getRoleServicesRoute, getRoleServicesHandler);

const writeApp = new OpenAPIHono<AppEnv>();
writeApp.use("*", requirePermission("ROLE_MANAGEMENT", "create"));
writeApp.openapi(createRoleRoute, createRoleHandler);

const updateApp = new OpenAPIHono<AppEnv>();
updateApp.use("*", requirePermission("ROLE_MANAGEMENT", "update"));
updateApp.openapi(updateRoleRoute, updateRoleHandler);
updateApp.openapi(setPermissionsRoute, setPermissionsHandler);
updateApp.openapi(setRoleServicesRoute, setRoleServicesHandler);

const deleteApp = new OpenAPIHono<AppEnv>();
deleteApp.use("*", requirePermission("ROLE_MANAGEMENT", "delete"));
deleteApp.openapi(deleteRoleRoute, deleteRoleHandler);

rolesApp.route("/", readApp);
rolesApp.route("/", writeApp);
rolesApp.route("/", updateApp);
rolesApp.route("/", deleteApp);

export default rolesApp;
