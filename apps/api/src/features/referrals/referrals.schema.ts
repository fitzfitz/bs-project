import { z } from "@hono/zod-openapi";
import { ReferralStatusEnum } from "../../utils/zod-prisma";

export const referralSchema = z
  .object({
    id: z.string(),
    referrerId: z.string(),
    refereeId: z.string(),
    bonusPoints: z.number().int(),
    status: ReferralStatusEnum,
    completedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("Referral");

export const applyReferralSchema = z.object({
  referralCode: z.string().min(1),
});

export const referralHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
