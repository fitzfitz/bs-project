import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  customerMembershipSchema,
  loyaltyTransactionSchema,
  loyaltyHistoryQuery,
  redeemPointsSchema,
  adjustPointsSchema,
} from "./loyalty.schema";
import { LoyaltyService } from "./loyalty.service";

// ─── GET /me ────────────────────────────────────────────────────────────────

export const getMyLoyaltyRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Loyalty"],
  summary: "Get current user loyalty account",
  responses: {
    200: {
      description: "Loyalty account data",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: customerMembershipSchema }),
        },
      },
    },
    404: { description: "Loyalty account not found" },
  },
});

export const getMyLoyaltyHandler: RouteHandler<typeof getMyLoyaltyRoute, AppEnv> = async (c) => {
  const userId = (c.get("userId") ?? c.var.userId) as string;
  const organizationId = c.get("organizationId")!;
  const account = await c.var.db.customerMembership.findFirst({
    where: { userId, organizationId },
  });

  if (!account) {
    return c.json({ success: false as const, message: "Loyalty account not found" }, 404);
  }

  return c.json({
    success: true as const,
    data: {
      id: account.id,
      userId: account.userId,
      pointsBalance: account.pointsBalance,
      lifetimePoints: account.lifetimePoints,
      tier: account.tier,
      tierMultiplier: account.tierMultiplier,
      pointsExpiringAt: account.pointsExpiringAt?.toISOString() ?? null,
      lastActivityAt: account.lastActivityAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
    },
  }, 200);
};

// ─── GET /me/history ────────────────────────────────────────────────────────

export const getMyLoyaltyHistoryRoute = createRoute({
  method: "get",
  path: "/me/history",
  tags: ["Loyalty"],
  summary: "Get loyalty points transaction history",
  request: { query: loyaltyHistoryQuery },
  responses: {
    200: {
      description: "Loyalty transaction history",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(loyaltyTransactionSchema),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

export const getMyLoyaltyHistoryHandler: RouteHandler<typeof getMyLoyaltyHistoryRoute, AppEnv> = async (c) => {
  const userId = c.var.userId as string;
  const account = await c.var.db.customerMembership.findUnique({ where: { userId } });

  if (!account) {
    return c.json({ success: true as const, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 200);
  }

  const { page, limit } = c.req.valid("query");
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    c.var.db.loyaltyTransaction.findMany({
      where: { customerMembershipId: account.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    c.var.db.loyaltyTransaction.count({ where: { customerMembershipId: account.id } }),
  ]);

  return c.json({
    success: true as const,
    data: transactions.map((t) => ({
      id: t.id,
      points: t.points,
      description: t.description,
      transactionId: t.transactionId ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }, 200);
};

// ─── POST /redeem ───────────────────────────────────────────────────────────

export const redeemRoute = createRoute({
  method: "post",
  path: "/redeem",
  tags: ["Loyalty"],
  summary: "Redeem loyalty points against a transaction",
  request: {
    body: { content: { "application/json": { schema: redeemPointsSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Points redeemed",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ pointsRedeemed: z.number(), discountAmount: z.number() }),
          }),
        },
      },
    },
    400: { description: "Validation error" },
  },
});

export const redeemHandler: RouteHandler<typeof redeemRoute, AppEnv> = async (c) => {
  const userId = c.var.userId as string;
  const { points, transactionId } = c.req.valid("json");

  const tx = await c.var.db.transaction.findUnique({ where: { id: transactionId }, select: { netAmount: true } });
  if (!tx) return c.json({ success: false as const, message: "Transaction not found" }, 400);

  const result = await c.var.db.$transaction(async (prisma) =>
    LoyaltyService.redeemPoints(prisma, userId, points, transactionId, tx.netAmount),
  );

  return c.json({ success: true as const, data: result }, 200);
};

// ─── GET /:userId (admin) ───────────────────────────────────────────────────

export const getAccountRoute = createRoute({
  method: "get",
  path: "/:userId",
  tags: ["Loyalty"],
  summary: "Get a user's loyalty account (admin)",
  request: { params: z.object({ userId: z.string() }) },
  responses: {
    200: {
      description: "Loyalty account",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: customerMembershipSchema }) } },
    },
    404: { description: "Not found" },
  },
});

export const getAccountHandler: RouteHandler<typeof getAccountRoute, AppEnv> = async (c) => {
  const { userId } = c.req.valid("param");
  const account = await c.var.db.customerMembership.findUnique({ where: { userId } });
  if (!account) return c.json({ success: false as const, message: "Account not found" }, 404);

  return c.json({
    success: true as const,
    data: {
      id: account.id,
      userId: account.userId,
      pointsBalance: account.pointsBalance,
      lifetimePoints: account.lifetimePoints,
      tier: account.tier,
      tierMultiplier: account.tierMultiplier,
      pointsExpiringAt: account.pointsExpiringAt?.toISOString() ?? null,
      lastActivityAt: account.lastActivityAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
    },
  }, 200);
};

// ─── POST /admin/expire ─────────────────────────────────────────────────────

export const expireRoute = createRoute({
  method: "post",
  path: "/admin/expire",
  tags: ["Loyalty"],
  summary: "Process point expiry (admin manual trigger)",
  responses: {
    200: {
      description: "Expiry results",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ accountsProcessed: z.number(), totalExpired: z.number() }),
          }),
        },
      },
    },
  },
});

export const expireHandler: RouteHandler<typeof expireRoute, AppEnv> = async (c) => {
  const result = await LoyaltyService.processPointExpiry(c.var.db);
  return c.json({ success: true as const, data: result }, 200);
};

// ─── PATCH /admin/adjust ────────────────────────────────────────────────────

export const adjustRoute = createRoute({
  method: "patch",
  path: "/admin/adjust",
  tags: ["Loyalty"],
  summary: "Manual point adjustment (admin)",
  request: {
    body: { content: { "application/json": { schema: adjustPointsSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Adjusted",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), message: z.string() }),
        },
      },
    },
  },
});

export const adjustHandler: RouteHandler<typeof adjustRoute, AppEnv> = async (c) => {
  const adminId = (c.get("userId") ?? c.var.userId) as string;
  const organizationId = c.get("organizationId")!;
  const { userId, points, description } = c.req.valid("json");
  await LoyaltyService.adjustPoints(c.var.db, userId, points, description, adminId, organizationId);
  return c.json({ success: true as const, message: `Adjusted ${points} points for user ${userId}` }, 200);
};
