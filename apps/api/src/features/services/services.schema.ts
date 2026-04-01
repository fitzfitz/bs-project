import { z } from "zod";
import { ServiceTypeEnum, StaffTierEnum } from "../../utils/zod-prisma";

// ============================================================================
// Service Schemas
// ============================================================================

export const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  type: ServiceTypeEnum.default("STANDARD"),
  basePrice: z.number().positive("Price must be positive"),
  durationMinutes: z.number().int().positive("Duration must be positive"),
  bufferMinutes: z.number().int().min(0).default(5),
  isCommissionable: z.boolean().default(true),
  loyaltyEligible: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateServiceSchema = createServiceSchema.partial();

export const serviceIdParam = z.object({
  id: z.string().min(1),
});

export const listServicesQuery = z.object({
  category: z.string().optional(),
  type: ServiceTypeEnum.optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// Tier Surcharge Schemas
// ============================================================================

export const createTierSurchargeSchema = z.object({
  tier: StaffTierEnum,
  surcharge: z.number().min(0, "Surcharge must be non-negative"),
});

// ============================================================================
// Combo Service Schemas
// ============================================================================

export const addComboChildSchema = z.object({
  childServiceId: z.string().min(1, "Child service ID is required"),
});

// ============================================================================
// Branch Service Override Schemas
// ============================================================================

export const branchOverrideSchema = z.object({
  branchId: z.string().min(1),
  overridePrice: z.number().positive().nullable(),
  isActive: z.boolean().default(true),
});

// ============================================================================
// Response / entity schemas
// ============================================================================

export const TierSurchargeSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  organizationId: z.string(),
  tier: StaffTierEnum,
  surcharge: z.number(),
});

export const BranchServiceOverrideSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  serviceId: z.string(),
  organizationId: z.string(),
  overridePrice: z.number().nullable(),
  isActive: z.boolean(),
});

export const ServiceScalarSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  type: ServiceTypeEnum,
  basePrice: z.number(),
  durationMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
  isCommissionable: z.boolean(),
  loyaltyEligible: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ComboServiceScalarSchema = z.object({
  id: z.string(),
  comboId: z.string(),
  childServiceId: z.string(),
  organizationId: z.string(),
});

export const ComboServiceWithChildSchema = ComboServiceScalarSchema.extend({
  childService: ServiceScalarSchema,
});

export const ServiceWithRelationsSchema = ServiceScalarSchema.extend({
  tierSurcharges: z.array(TierSurchargeSchema),
  comboChildren: z.array(ComboServiceWithChildSchema),
  branchOverrides: z.array(BranchServiceOverrideSchema),
});

export const serviceResponseSchema = ServiceScalarSchema;

// ============================================================================
// Types
// ============================================================================

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServiceResponse = z.infer<typeof ServiceScalarSchema>;
