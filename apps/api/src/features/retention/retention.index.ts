import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  triggerRoute, triggerHandler,
  statsRoute, statsHandler,
} from "./retention.handlers";

const retentionApp = new OpenAPIHono<AppEnv>();

retentionApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("RETENTION", "read"));
retentionApp.openapi(triggerRoute, triggerHandler);
retentionApp.openapi(statsRoute, statsHandler);

export default retentionApp;
