import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  registerRoute,
  registerHandler,
  loginRoute,
  loginHandler,
  refreshRoute,
  refreshHandler,
  forgotPasswordRoute,
  forgotPasswordHandler,
  googleAuthRoute,
  googleAuthHandler,
  meRoute,
  meHandler,
  updateProfileRoute,
  updateProfileHandler,
  deleteAccountRoute,
  deleteAccountHandler,
  searchUsersRoute,
  searchUsersHandler,
} from "./auth.handlers";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";

const authApp = new OpenAPIHono<AppEnv>()
  .openapi(registerRoute, registerHandler)
  .openapi(loginRoute, loginHandler)
  .openapi(refreshRoute, refreshHandler)
  .openapi(forgotPasswordRoute, forgotPasswordHandler)
  .openapi(googleAuthRoute, googleAuthHandler);

// Protected routes sub-router
const protectedApp = new OpenAPIHono<AppEnv>();
protectedApp.use("*", authMiddleware(), orgScopeMiddleware());
protectedApp.openapi(meRoute, meHandler);
protectedApp.openapi(updateProfileRoute, updateProfileHandler);
protectedApp.openapi(deleteAccountRoute, deleteAccountHandler);

// Admin-only routes
const adminApp = new OpenAPIHono<AppEnv>();
adminApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("USER_MANAGEMENT", "read"));
adminApp.openapi(searchUsersRoute, searchUsersHandler);

authApp.route("/", protectedApp);
authApp.route("/", adminApp);

export default authApp;
