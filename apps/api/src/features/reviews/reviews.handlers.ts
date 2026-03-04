import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  createReviewSchema,
  reviewResponseSchema,
  listReviewsQuery,
  moderateReviewSchema,
} from "./reviews.schema";
import { ReviewService } from "./reviews.service";

function mapReview(r: any) {
  const staffUser = r.staff?.user;
  return {
    id: r.id,
    customerId: r.customerId,
    customerName: `${r.customer?.firstName ?? ""} ${r.customer?.lastName ?? ""}`.trim(),
    staffProfileId: r.staffProfileId ?? null,
    staffName: staffUser
      ? `${staffUser.firstName ?? ""} ${staffUser.lastName ?? ""}`.trim()
      : null,
    branchId: r.branchId ?? null,
    rating: r.rating,
    comment: r.comment ?? null,
    photoUrls: r.photoUrls,
    isVisible: r.isVisible,
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── POST / ─────────────────────────────────────────────────────────────────

export const createReviewRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Reviews"],
  summary: "Create a review for a branch/barber",
  request: {
    body: { content: { "application/json": { schema: createReviewSchema } }, required: true },
  },
  responses: {
    201: {
      description: "Review created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: reviewResponseSchema }) } },
    },
    400: { description: "Validation error" },
    403: { description: "Not visited" },
    409: { description: "Duplicate review" },
  },
});

export const createReviewHandler: RouteHandler<typeof createReviewRoute, AppEnv> = async (c) => {
  const userId = c.var.userId as string;
  const data = c.req.valid("json");
  try {
    const review = await ReviewService.createReview(c.var.db, userId, c.get("organizationId")!, data);
    return c.json({ success: true as const, data: mapReview(review) }, 201);
  } catch (err: any) {
    if (err.message.includes("already reviewed")) return c.json({ success: false as const, message: err.message }, 409);
    if (err.message.includes("only review")) return c.json({ success: false as const, message: err.message }, 403);
    return c.json({ success: false as const, message: err.message }, 400);
  }
};

// ─── GET / ──────────────────────────────────────────────────────────────────

export const listReviewsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Reviews"],
  summary: "List reviews (public)",
  request: { query: listReviewsQuery },
  responses: {
    200: {
      description: "Review list",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(reviewResponseSchema),
            pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
          }),
        },
      },
    },
  },
});

export const listReviewsHandler: RouteHandler<typeof listReviewsRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const result = await ReviewService.listReviews(c.var.db, query);
  return c.json({
    success: true as const,
    data: result.items.map(mapReview),
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  }, 200);
};

// ─── GET /:id ───────────────────────────────────────────────────────────────

export const getReviewRoute = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Reviews"],
  summary: "Get a single review",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Review",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: reviewResponseSchema }) } },
    },
    404: { description: "Not found" },
  },
});

export const getReviewHandler: RouteHandler<typeof getReviewRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const review = await ReviewService.getReviewById(c.var.db, id);
  if (!review) return c.json({ success: false as const, message: "Review not found" }, 404);
  return c.json({ success: true as const, data: mapReview(review) }, 200);
};

// ─── PATCH /:id/moderate ────────────────────────────────────────────────────

export const moderateRoute = createRoute({
  method: "patch",
  path: "/:id/moderate",
  tags: ["Reviews"],
  summary: "Moderate a review (show/hide)",
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: moderateReviewSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Moderated",
      content: { "application/json": { schema: z.object({ success: z.literal(true), message: z.string() }) } },
    },
  },
});

export const moderateHandler: RouteHandler<typeof moderateRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  await ReviewService.moderateReview(c.var.db, id, c.var.userId as string, data);
  return c.json({ success: true as const, message: `Review ${data.isVisible ? "shown" : "hidden"}` }, 200);
};

// ─── DELETE /:id ────────────────────────────────────────────────────────────

export const deleteReviewRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Reviews"],
  summary: "Delete a review (SUPER_ADMIN)",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Deleted",
      content: { "application/json": { schema: z.object({ success: z.literal(true), message: z.string() }) } },
    },
  },
});

export const deleteReviewHandler: RouteHandler<typeof deleteReviewRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  await ReviewService.deleteReview(c.var.db, id);
  return c.json({ success: true as const, message: "Review deleted" }, 200);
};
