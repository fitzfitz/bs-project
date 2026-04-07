import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignResponseSchema,
  listCampaignsQuery,
} from "./campaigns.schema";
import { CampaignService } from "./campaigns.service";
import { createNotificationService } from "../../utils/notifications";

function mapCampaign(c: any) {
  return {
    id: c.id,
    branchId: c.branchId ?? null,
    name: c.name,
    description: c.description ?? null,
    type: c.type,
    promoCodeId: c.promoCodeId ?? null,
    segmentId: c.segmentId ?? null,
    status: c.status,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt?.toISOString() ?? null,
    sentCount: c.sentCount,
    openCount: c.openCount,
    createdAt: c.createdAt.toISOString(),
  };
}

// ─── GET / ──────────────────────────────────────────────────────────────────

export const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Campaigns"],
  summary: "List campaigns",
  request: { query: listCampaignsQuery },
  responses: {
    200: {
      description: "Campaign list",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(campaignResponseSchema),
            pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
          }),
        },
      },
    },
  },
});

export const listHandler: RouteHandler<typeof listRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const result = await CampaignService.list(c.var.db, query);
  return c.json({
    success: true as const,
    data: result.items.map(mapCampaign),
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  }, 200);
};

// ─── POST / ─────────────────────────────────────────────────────────────────

export const createRoute_ = createRoute({
  method: "post",
  path: "/",
  tags: ["Campaigns"],
  summary: "Create a campaign",
  request: {
    body: { content: { "application/json": { schema: createCampaignSchema } }, required: true },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: campaignResponseSchema }) } },
    },
    400: { description: "Validation error" },
  },
});

export const createHandler: RouteHandler<typeof createRoute_, AppEnv> = async (c) => {
  const data = c.req.valid("json");
  try {
    const campaign = await CampaignService.create(c.var.db, data, c.var.userId as string, c.get("organizationId")!);
    return c.json({ success: true as const, data: mapCampaign(campaign) }, 201);
  } catch (err: any) {
    return c.json({ success: false as const, message: err.message }, 400);
  }
};

// ─── PATCH /:id ─────────────────────────────────────────────────────────────

export const updateRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["Campaigns"],
  summary: "Update a campaign",
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateCampaignSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Updated",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: campaignResponseSchema }) } },
    },
    400: { description: "Error" },
  },
});

export const updateHandler: RouteHandler<typeof updateRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  try {
    const campaign = await CampaignService.update(c.var.db, id, data);
    return c.json({ success: true as const, data: mapCampaign(campaign) }, 200);
  } catch (err: any) {
    return c.json({ success: false as const, message: err.message }, 400);
  }
};

// ─── POST /:id/send ─────────────────────────────────────────────────────────

export const sendRoute = createRoute({
  method: "post",
  path: "/:id/send",
  tags: ["Campaigns"],
  summary: "Send a campaign to its target audience",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Sent",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ sent: z.number(), recipientCount: z.number() }),
          }),
        },
      },
    },
    400: { description: "Error" },
  },
});

export const sendHandler: RouteHandler<typeof sendRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const ns = createNotificationService(c.env, c.var.db);
  try {
    const result = await CampaignService.sendCampaign(c.var.db, id, ns);
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: any) {
    return c.json({ success: false as const, message: err.message }, 400);
  }
};

// ─── DELETE /:id ────────────────────────────────────────────────────────────

export const deleteRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Campaigns"],
  summary: "Delete a campaign",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Deleted",
      content: { "application/json": { schema: z.object({ success: z.literal(true), message: z.string() }) } },
    },
  },
});

export const deleteHandler: RouteHandler<typeof deleteRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  await CampaignService.deleteCampaign(c.var.db, id);
  return c.json({ success: true as const, message: "Campaign deleted" }, 200);
};
