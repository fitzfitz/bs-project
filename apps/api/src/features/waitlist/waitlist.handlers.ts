import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { createSuccessSchema, ErrorSchema } from "../../utils/openapi";
import {
  joinWaitlistBody,
  waitlistIdParam,
  adminWaitlistQuery,
  WaitlistEntryResponseSchema,
  WaitlistEntryAdminSchema,
} from "./waitlist.schema";
import { WaitlistService } from "./waitlist.service";

export const joinWaitlistRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Waitlist"],
  summary: "Join branch waitlist for a time slot",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: joinWaitlistBody } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: createSuccessSchema(WaitlistEntryResponseSchema) },
      },
      description: "Joined waitlist",
    },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Disabled or slot full" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Branch or user not found" },
  },
});

export const joinWaitlistHandler: RouteHandler<typeof joinWaitlistRoute, AppEnv> = async (c) => {
  const data = c.req.valid("json");
  const userId = c.get("userId")!;
  const organizationId = c.get("organizationId")!;
  const entry = await WaitlistService.joinWaitlist(c.var.db, organizationId, userId, data);
  return c.json({ success: true as const, data: entry }, 201);
};

export const myWaitlistRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Waitlist"],
  summary: "List current user's active waitlist entries",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(z.array(WaitlistEntryResponseSchema)) },
      },
      description: "Waitlist entries",
    },
  },
});

export const myWaitlistHandler: RouteHandler<typeof myWaitlistRoute, AppEnv> = async (c) => {
  const userId = c.get("userId")!;
  const organizationId = c.get("organizationId")!;
  const rows = await WaitlistService.getMyWaitlist(c.var.db, organizationId, userId);
  return c.json({ success: true as const, data: rows }, 200);
};

export const leaveWaitlistRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Waitlist"],
  summary: "Leave waitlist (cancel own entry)",
  security: [{ bearerAuth: [] }],
  request: { params: waitlistIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(WaitlistEntryResponseSchema) },
      },
      description: "Entry cancelled",
    },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid state" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Not your entry" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

export const leaveWaitlistHandler: RouteHandler<typeof leaveWaitlistRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const userId = c.get("userId")!;
  const organizationId = c.get("organizationId")!;
  const entry = await WaitlistService.leaveWaitlist(c.var.db, organizationId, userId, id);
  return c.json({ success: true as const, data: entry }, 200);
};

export const adminWaitlistRoute = createRoute({
  method: "get",
  path: "/admin",
  tags: ["Waitlist (Admin)"],
  summary: "List waitlist entries for a branch",
  security: [{ bearerAuth: [] }],
  request: { query: adminWaitlistQuery },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(z.array(WaitlistEntryAdminSchema)) },
      },
      description: "Branch waitlist",
    },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
  },
});

export const adminWaitlistHandler: RouteHandler<typeof adminWaitlistRoute, AppEnv> = async (c) => {
  const { branchId } = c.req.valid("query");
  const rows = await WaitlistService.getAdminWaitlist(c.var.db, branchId);
  return c.json({ success: true as const, data: rows }, 200);
};
