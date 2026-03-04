import { z } from "@hono/zod-openapi";

export const customerMembershipSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    pointsBalance: z.number().int(),
    lifetimePoints: z.number().int(),
    tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
    tierMultiplier: z.number(),
    pointsExpiringAt: z.string().datetime().nullable(),
    lastActivityAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("CustomerMembership");

export const loyaltyTransactionSchema = z
  .object({
    id: z.string(),
    points: z.number().int(),
    description: z.string(),
    transactionId: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("LoyaltyTransactionRecord");

export const redeemPointsSchema = z.object({
  points: z.number().int().min(1),
  transactionId: z.string(),
});

export const adjustPointsSchema = z.object({
  userId: z.string(),
  points: z.number().int(),
  description: z.string().min(1).max(200),
});

export const loyaltyHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
