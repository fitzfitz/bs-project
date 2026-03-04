import { z } from '@hono/zod-openapi';
import { DiscountType } from '@prisma/client';

export const DiscountTypeSchema = z.nativeEnum(DiscountType);

export const PromoCodeSchema = z.object({
  id: z.string().cuid(),
  code: z.string().openapi({ example: 'WELCOME10' }),
  description: z.string().nullable().openapi({ example: '10% off for first-time customers' }),
  type: DiscountTypeSchema.openapi({ example: 'PERCENTAGE' }),
  value: z.number().openapi({ example: 10 }),
  minGrossAmount: z.number().openapi({ example: 50000 }),
  maxDiscount: z.number().nullable().openapi({ example: 50000 }),
  usageLimit: z.number().nullable().openapi({ example: 100 }),
  usageCount: z.number().openapi({ example: 0 }),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable(),
  isActive: z.boolean().openapi({ example: true }),
  branchId: z.string().nullable().openapi({ example: 'branch_id' }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('PromoCode');

export const CreatePromoCodeSchema = PromoCodeSchema.omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePromoCodeSchema = CreatePromoCodeSchema.partial();

export const PromoCodeIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const ValidatePromoCodeSchema = z.object({
  code: z.string().openapi({ example: 'WELCOME10' }),
  branchId: z.string().openapi({ example: 'branch_id' }),
  grossAmount: z.number().openapi({ example: 100000 }),
  organizationId: z.string().optional(), // Injected server-side from auth context
});

export type PromoCode = z.infer<typeof PromoCodeSchema>;
export type CreatePromoCodeInput = z.infer<typeof CreatePromoCodeSchema>;
export type UpdatePromoCodeInput = z.infer<typeof UpdatePromoCodeSchema>;
export type ValidatePromoCodeInput = z.infer<typeof ValidatePromoCodeSchema>;
