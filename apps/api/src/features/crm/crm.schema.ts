import { z } from "@hono/zod-openapi";

export const customerInsightsSchema = z
  .object({
    customerId: z.string(),
    customerName: z.string(),
    email: z.string(),
    totalVisits: z.number().int(),
    totalSpend: z.number(),
    averageSpend: z.number(),
    lastVisitAt: z.string().datetime().nullable(),
    daysSinceLastVisit: z.number().int().nullable(),
    favoriteServices: z.array(z.string()),
    loyaltyTier: z.string(),
    segment: z.string().nullable(),
  })
  .openapi("CustomerInsights");

export const listCustomersQuery = z.object({
  branchId: z.string(),
  segment: z.string().optional(),
  minVisits: z.coerce.number().int().optional(),
  sortBy: z.enum(["spend", "visits", "recency"]).default("recency"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const segmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    memberCount: z.number().int(),
    isAutomatic: z.boolean(),
  })
  .openapi("CustomerSegment");

export const recomputeSegmentsSchema = z.object({
  branchId: z.string(),
});
