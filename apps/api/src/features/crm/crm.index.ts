import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listCustomersRoute, listCustomersHandler,
  getCustomerRoute, getCustomerHandler,
  listSegmentsRoute, listSegmentsHandler,
  recomputeRoute, recomputeHandler,
} from "./crm.handlers";

const crmApp = new OpenAPIHono<AppEnv>();

crmApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("CRM", "read"));

crmApp.openapi(listCustomersRoute, listCustomersHandler);
crmApp.openapi(getCustomerRoute, getCustomerHandler);
crmApp.openapi(listSegmentsRoute, listSegmentsHandler);
crmApp.openapi(recomputeRoute, recomputeHandler);

export default crmApp;
