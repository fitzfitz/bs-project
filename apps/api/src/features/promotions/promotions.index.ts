import { OpenAPIHono } from "@hono/zod-openapi";
import {
  listPromoCodesRoute,
  createPromoCodeRoute,
  updatePromoCodeRoute,
  deletePromoCodeRoute,
  validatePromoCodeRoute,
  validateLoyaltyRoute,
  listPromoCodesHandler,
  createPromoCodeHandler,
  updatePromoCodeHandler,
  deletePromoCodeHandler,
  validatePromoCodeHandler,
  validateLoyaltyHandler,
} from "./promotions.handlers";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";

const promotionsApp = new OpenAPIHono<AppEnv>();

// Read: any authenticated user can list promo codes and validate
const readApp = new OpenAPIHono<AppEnv>();
readApp.use("*", authMiddleware(), orgScopeMiddleware());
readApp.openapi(listPromoCodesRoute, listPromoCodesHandler);
readApp.openapi(validatePromoCodeRoute, validatePromoCodeHandler);
readApp.openapi(validateLoyaltyRoute, validateLoyaltyHandler);

// Write: requires PROMOTIONS permission
const writeApp = new OpenAPIHono<AppEnv>();
writeApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("PROMOTIONS", "create"));
writeApp.openapi(createPromoCodeRoute, createPromoCodeHandler);
writeApp.openapi(updatePromoCodeRoute, updatePromoCodeHandler);
writeApp.openapi(deletePromoCodeRoute, deletePromoCodeHandler);

promotionsApp.route("/", readApp);
promotionsApp.route("/", writeApp);

export default promotionsApp;
