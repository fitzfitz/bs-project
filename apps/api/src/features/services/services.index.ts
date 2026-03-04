import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listServicesRoute,
  listServicesHandler,
  getServiceRoute,
  getServiceHandler,
  createServiceRoute,
  createServiceHandler,
  updateServiceRoute,
  updateServiceHandler,
  deleteServiceRoute,
  deleteServiceHandler,
  addTierSurchargeRoute,
  addTierSurchargeHandler,
  addComboChildRoute,
  addComboChildHandler,
  setBranchOverrideRoute,
  setBranchOverrideHandler,
} from "./services.handlers";

const servicesApp = new OpenAPIHono<AppEnv>();

// Public (anyone can browse)
servicesApp.openapi(listServicesRoute, listServicesHandler);
servicesApp.openapi(getServiceRoute, getServiceHandler);

// Create
servicesApp.use("/", authMiddleware(), orgScopeMiddleware(), requirePermission("SERVICE_CATALOG", "create"));
servicesApp.openapi(createServiceRoute, createServiceHandler);

// Update
servicesApp.use("/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("SERVICE_CATALOG", "update"));
servicesApp.openapi(updateServiceRoute, updateServiceHandler);

// Delete
servicesApp.use("/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("SERVICE_CATALOG", "delete"));
servicesApp.openapi(deleteServiceRoute, deleteServiceHandler);

servicesApp.use("/:id/tier-surcharge", authMiddleware(), orgScopeMiddleware(), requirePermission("SERVICE_CATALOG", "update"));
servicesApp.openapi(addTierSurchargeRoute, addTierSurchargeHandler);

servicesApp.use("/:id/combo", authMiddleware(), orgScopeMiddleware(), requirePermission("SERVICE_CATALOG", "update"));
servicesApp.openapi(addComboChildRoute, addComboChildHandler);

servicesApp.use("/:id/branch-override", authMiddleware(), orgScopeMiddleware(), requirePermission("SERVICE_CATALOG", "update"));
servicesApp.openapi(setBranchOverrideRoute, setBranchOverrideHandler);

export default servicesApp;
