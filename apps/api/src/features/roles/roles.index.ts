import { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono/types";
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

/** Only enforce each action on matching methods so merged sub-apps do not block other verbs (e.g. create on PATCH/DELETE). */
function guardMethods(
  methods: Set<string>,
  featureCode: Parameters<typeof requirePermission>[0],
  action: Parameters<typeof requirePermission>[1],
): MiddlewareHandler<AppEnv> {
  const check = requirePermission(featureCode, action);
  return async (c, next) => {
    if (!methods.has(c.req.method)) return next();
    return check(c, next);
  };
}

const readApp = new OpenAPIHono<AppEnv>();
readApp.use("*", guardMethods(new Set(["GET"]), "ROLE_MANAGEMENT", "read"));
readApp.openapi(listRolesRoute, listRolesHandler);
readApp.openapi(getPermissionsRoute, getPermissionsHandler);
readApp.openapi(getRoleServicesRoute, getRoleServicesHandler);

const writeApp = new OpenAPIHono<AppEnv>();
writeApp.use("*", guardMethods(new Set(["POST"]), "ROLE_MANAGEMENT", "create"));
writeApp.openapi(createRoleRoute, createRoleHandler);

const updateApp = new OpenAPIHono<AppEnv>();
updateApp.use(
  "*",
  guardMethods(new Set(["PATCH", "PUT"]), "ROLE_MANAGEMENT", "update"),
);
updateApp.openapi(updateRoleRoute, updateRoleHandler);
updateApp.openapi(setPermissionsRoute, setPermissionsHandler);
updateApp.openapi(setRoleServicesRoute, setRoleServicesHandler);

const deleteApp = new OpenAPIHono<AppEnv>();
deleteApp.use("*", guardMethods(new Set(["DELETE"]), "ROLE_MANAGEMENT", "delete"));
deleteApp.openapi(deleteRoleRoute, deleteRoleHandler);

rolesApp.route("/", readApp);
rolesApp.route("/", writeApp);
rolesApp.route("/", updateApp);
rolesApp.route("/", deleteApp);

export default rolesApp;
