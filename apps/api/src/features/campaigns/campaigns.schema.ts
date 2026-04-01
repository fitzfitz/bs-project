import { z } from "@hono/zod-openapi";
import { CampaignTypeEnum, CampaignStatusEnum } from "../../utils/zod-prisma";

export const createCampaignSchema = z.object({
  branchId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: CampaignTypeEnum,
  promoCodeId: z.string().optional(),
  segmentId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: CampaignTypeEnum.optional(),
  promoCodeId: z.string().nullable().optional(),
  segmentId: z.string().nullable().optional(),
  status: CampaignStatusEnum.extract(["DRAFT", "SCHEDULED", "CANCELLED"]).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const campaignResponseSchema = z
  .object({
    id: z.string(),
    branchId: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    type: CampaignTypeEnum,
    promoCodeId: z.string().nullable(),
    segmentId: z.string().nullable(),
    status: CampaignStatusEnum,
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    sentCount: z.number().int(),
    openCount: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .openapi("Campaign");

export const listCampaignsQuery = z.object({
  branchId: z.string().optional(),
  status: CampaignStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
