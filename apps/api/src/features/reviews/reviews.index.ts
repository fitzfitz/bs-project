import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  createReviewRoute, createReviewHandler,
  listReviewsRoute, listReviewsHandler,
  getReviewRoute, getReviewHandler,
  moderateRoute, moderateHandler,
  deleteReviewRoute, deleteReviewHandler,
} from "./reviews.handlers";

const reviewsApp = new OpenAPIHono<AppEnv>();

// Public (no auth) — list and get
reviewsApp.openapi(listReviewsRoute, listReviewsHandler);
reviewsApp.openapi(getReviewRoute, getReviewHandler);

// Customer — create (any authenticated user)
const customerRoutes = new OpenAPIHono<AppEnv>();
customerRoutes.use("*", authMiddleware(), orgScopeMiddleware());
customerRoutes.openapi(createReviewRoute, createReviewHandler);
reviewsApp.route("/", customerRoutes);

// Moderate
const managerRoutes = new OpenAPIHono<AppEnv>();
managerRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("REVIEWS", "update"));
managerRoutes.openapi(moderateRoute, moderateHandler);
reviewsApp.route("/", managerRoutes);

// Delete
const adminRoutes = new OpenAPIHono<AppEnv>();
adminRoutes.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("REVIEWS", "delete"));
adminRoutes.openapi(deleteReviewRoute, deleteReviewHandler);
reviewsApp.route("/", adminRoutes);

export default reviewsApp;
