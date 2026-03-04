import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission, requireCustomer } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  getMyLoyaltyRoute,
  getMyLoyaltyHandler,
  getMyLoyaltyHistoryRoute,
  getMyLoyaltyHistoryHandler,
  redeemRoute,
  redeemHandler,
  getAccountRoute,
  getAccountHandler,
  expireRoute,
  expireHandler,
  adjustRoute,
  adjustHandler,
} from "./loyalty.handlers";

const loyaltyApp = new OpenAPIHono<AppEnv>();

// Customer-facing routes
const customerRoutes = new OpenAPIHono<AppEnv>();
customerRoutes.use("*", authMiddleware(), orgScopeMiddleware());
customerRoutes.openapi(getMyLoyaltyRoute, getMyLoyaltyHandler);
customerRoutes.openapi(getMyLoyaltyHistoryRoute, getMyLoyaltyHistoryHandler);
customerRoutes.openapi(redeemRoute, redeemHandler);

// Admin routes
const adminRoutes = new OpenAPIHono<AppEnv>();
adminRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("LOYALTY", "update"));
adminRoutes.openapi(getAccountRoute, getAccountHandler);
adminRoutes.openapi(expireRoute, expireHandler);
adminRoutes.openapi(adjustRoute, adjustHandler);

loyaltyApp.route("/", customerRoutes);
loyaltyApp.route("/", adminRoutes);

export default loyaltyApp;
