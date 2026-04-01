import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { referralSchema, applyReferralSchema, referralHistoryQuery } from "./referrals.schema";
import { ReferralService } from "./referrals.service";

// ─── GET /me/code ───────────────────────────────────────────────────────────

export const getMyCodeRoute = createRoute({
  method: "get",
  path: "/me/code",
  tags: ["Referrals"],
  summary: "Get or generate the current user's referral code",
  responses: {
    200: {
      description: "Referral code",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.object({ referralCode: z.string() }) }),
        },
      },
    },
  },
});

export const getMyCodeHandler: RouteHandler<typeof getMyCodeRoute, AppEnv> = async (c) => {
  const userId = c.var.userId as string;
  const referralCode = await ReferralService.getOrCreateReferralCode(c.var.db, userId);
  return c.json({ success: true as const, data: { referralCode } }, 200);
};

// ─── POST /apply ────────────────────────────────────────────────────────────

export const applyRoute = createRoute({
  method: "post",
  path: "/apply",
  tags: ["Referrals"],
  summary: "Apply a referral code",
  request: {
    body: { content: { "application/json": { schema: applyReferralSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Referral applied",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: referralSchema }),
        },
      },
    },
    400: { description: "Invalid code" },
    409: { description: "Already referred" },
  },
});

export const applyHandler: RouteHandler<typeof applyRoute, AppEnv> = async (c) => {
  const userId = c.var.userId as string;
  const { referralCode } = c.req.valid("json");

  try {
    const referral = await ReferralService.applyReferralCode(c.var.db, userId, referralCode);
    return c.json({
      success: true as const,
      data: {
        id: referral.id,
        referrerId: referral.referrerId,
        refereeId: referral.refereeId,
        bonusPoints: referral.bonusPoints,
        status: referral.status,
        completedAt: referral.completedAt?.toISOString() ?? null,
        createdAt: referral.createdAt.toISOString(),
      },
    }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Already")) {
      return c.json({ success: false as const, message }, 409);
    }
    return c.json({ success: false as const, message }, 400);
  }
};

// ─── GET /me/history ────────────────────────────────────────────────────────

export const historyRoute = createRoute({
  method: "get",
  path: "/me/history",
  tags: ["Referrals"],
  summary: "Get referral history for the current user",
  request: { query: referralHistoryQuery },
  responses: {
    200: {
      description: "Referral list",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.object({
              id: z.string(),
              status: z.string(),
              bonusPoints: z.number(),
              refereeName: z.string(),
              completedAt: z.string().nullable(),
              createdAt: z.string(),
            })),
            pagination: z.object({
              page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

export const historyHandler: RouteHandler<typeof historyRoute, AppEnv> = async (c) => {
  const userId = c.var.userId as string;
  const { page, limit } = c.req.valid("query");
  const result = await ReferralService.getReferralHistory(c.var.db, userId, page, limit);

  return c.json({
    success: true as const,
    data: result.items.map((r) => ({
      id: r.id,
      status: r.status,
      bonusPoints: r.bonusPoints,
      refereeName: `${r.referee.firstName} ${r.referee.lastName}`.trim(),
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  }, 200);
};

// ─── GET /stats (admin) ─────────────────────────────────────────────────────

export const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  tags: ["Referrals"],
  summary: "Referral program stats (admin)",
  responses: {
    200: {
      description: "Stats",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              total: z.number(), completed: z.number(), pending: z.number(), conversionRate: z.number(),
            }),
          }),
        },
      },
    },
  },
});

export const statsHandler: RouteHandler<typeof statsRoute, AppEnv> = async (c) => {
  const stats = await ReferralService.getReferralStats(c.var.db);
  return c.json({ success: true as const, data: stats }, 200);
};
