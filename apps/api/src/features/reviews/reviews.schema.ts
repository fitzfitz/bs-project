import { z } from "@hono/zod-openapi";

export const createReviewSchema = z.object({
  staffProfileId: z.string().optional(),
  branchId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(3).default([]),
  queueEntryId: z.string().optional(),
});

export const reviewResponseSchema = z
  .object({
    id: z.string(),
    customerId: z.string(),
    customerName: z.string(),
    staffProfileId: z.string().nullable(),
    staffName: z.string().nullable(),
    branchId: z.string().nullable(),
    rating: z.number().int(),
    comment: z.string().nullable(),
    photoUrls: z.array(z.string()),
    isVisible: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .openapi("Review");

export const listReviewsQuery = z.object({
  branchId: z.string().optional(),
  staffProfileId: z.string().optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  includeHidden: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const moderateReviewSchema = z.object({
  isVisible: z.boolean(),
  moderationNote: z.string().optional(),
});
