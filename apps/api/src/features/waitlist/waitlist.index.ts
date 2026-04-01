import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission, requireCustomer } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  joinWaitlistRoute,
  joinWaitlistHandler,
  myWaitlistRoute,
  myWaitlistHandler,
  leaveWaitlistRoute,
  leaveWaitlistHandler,
  adminWaitlistRoute,
  adminWaitlistHandler,
} from "./waitlist.handlers";

const waitlistApp = new OpenAPIHono<AppEnv>();

waitlistApp.use("/admin", authMiddleware(), orgScopeMiddleware(), requirePermission("QUEUE_MANAGEMENT", "read"));
waitlistApp.openapi(adminWaitlistRoute, adminWaitlistHandler);

waitlistApp.use("/me", authMiddleware(), requireCustomer());
waitlistApp.openapi(myWaitlistRoute, myWaitlistHandler);

waitlistApp.use("/:id", authMiddleware(), requireCustomer());
waitlistApp.openapi(leaveWaitlistRoute, leaveWaitlistHandler);

waitlistApp.use("/", authMiddleware(), requireCustomer());
waitlistApp.openapi(joinWaitlistRoute, joinWaitlistHandler);

export default waitlistApp;
