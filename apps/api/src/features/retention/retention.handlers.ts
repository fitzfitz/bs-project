import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { RetentionService } from "./retention.service";
import { createNotificationService } from "../../utils/notifications";

export const triggerRoute = createRoute({
  method: "post",
  path: "/trigger",
  tags: ["Retention"],
  summary: "Manually trigger retention nudges",
  responses: {
    200: {
      description: "Trigger results",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ atRiskSent: z.number(), expirySent: z.number() }),
          }),
        },
      },
    },
  },
});

export const triggerHandler: RouteHandler<typeof triggerRoute, AppEnv> = async (c) => {
  const ns = createNotificationService(c.env);
  const result = await RetentionService.processRetentionTriggers(c.var.db, ns);
  return c.json({ success: true as const, data: result }, 200);
};

export const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  tags: ["Retention"],
  summary: "Get retention nudge statistics",
  responses: {
    200: {
      description: "Stats",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ totalNudges: z.number(), last30Days: z.number() }),
          }),
        },
      },
    },
  },
});

export const statsHandler: RouteHandler<typeof statsRoute, AppEnv> = async (c) => {
  const stats = await RetentionService.getStats(c.var.db);
  return c.json({ success: true as const, data: stats }, 200);
};
