import { z } from "zod";

// ============================================================================
// Enums (mirroring Prisma)
// ============================================================================

export const ServiceTypeEnum = z.enum(["STANDARD", "COMBO", "ADD_ON"]);
export const StaffTierEnum = z.enum(["JUNIOR", "SENIOR", "MASTER"]);

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
// Response Schema
// ============================================================================

export const serviceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  type: ServiceTypeEnum,
  basePrice: z.number(),
  durationMinutes: z.number(),
  bufferMinutes: z.number(),
  isCommissionable: z.boolean(),
  loyaltyEligible: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============================================================================
// Types
// ============================================================================

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServiceResponse = z.infer<typeof serviceResponseSchema>;
