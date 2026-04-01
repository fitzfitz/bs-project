import { z } from "zod";
import { DayOfWeekEnum, TipDistributionEnum } from "../../utils/zod-prisma";
import { ServiceScalarSchema } from "../services/services.schema";

// ============================================================================
// Branch Schemas
// ============================================================================

export const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
  tipDistribution: TipDistributionEnum.optional(),
});

export const branchIdParam = z.object({
  id: z.string().min(1),
});

export const listBranchesQuery = z.object({
  city: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});

// ============================================================================
// Operating Hours Schemas
// ============================================================================

export const operatingHourSchema = z.object({
  day: DayOfWeekEnum,
  openTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(:00)?$/, "Must be HH:mm format"),
  closeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(:00)?$/, "Must be HH:mm format"),
  isClosed: z.boolean().default(false),
});

export const setOperatingHoursSchema = z.object({
  hours: z.array(operatingHourSchema),
});

// ============================================================================
// Surge Rule Schemas
// ============================================================================

export const surgeRuleSchema = z.object({
  name: z.string().min(1, "Surge rule name is required"),
  days: z.array(DayOfWeekEnum).min(1),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  multiplier: z.number().positive(),
  isActive: z.boolean().default(true),
});

export const createSurgeRuleSchema = surgeRuleSchema;
export const updateSurgeRuleSchema = surgeRuleSchema.partial();

export const surgeRuleIdParam = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
});

// ============================================================================
// Holiday Schemas
// ============================================================================

export const createBranchHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  name: z.string().min(1, "Holiday name is required"),
  isClosed: z.boolean().default(true),
  openTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:mm format")
    .optional()
    .nullable(),
  closeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:mm format")
    .optional()
    .nullable(),
});

export const updateBranchHolidaySchema = createBranchHolidaySchema.partial();

export const holidayIdParam = z.object({
  id: z.string().min(1),
  holidayId: z.string().min(1),
});

// ============================================================================
// Response / entity schemas
// ============================================================================

export const OperatingHourResponseSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  organizationId: z.string(),
  dayOfWeek: DayOfWeekEnum,
  openTime: z.string(),
  closeTime: z.string(),
  isClosed: z.boolean(),
});

export const SurgeRuleResponseSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  organizationId: z.string(),
  name: z.string(),
  dayOfWeek: DayOfWeekEnum,
  startHour: z.number().int(),
  endHour: z.number().int(),
  multiplier: z.number(),
  isActive: z.boolean(),
});

export const BranchScalarSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  isEmergencyClosed: z.boolean(),
  tipDistribution: TipDistributionEnum.nullable(),
  maxDiscountPercent: z.number().nullable(),
  averageRating: z.number(),
  totalReviews: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BranchWithRelationsSchema = BranchScalarSchema.extend({
  operatingHours: z.array(OperatingHourResponseSchema),
  surgeRules: z.array(SurgeRuleResponseSchema),
});

export const BranchServiceOverrideWithServiceSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  serviceId: z.string(),
  organizationId: z.string(),
  overridePrice: z.number().nullable(),
  isActive: z.boolean(),
  service: ServiceScalarSchema,
});

export const BranchDetailSchema = BranchScalarSchema.extend({
  operatingHours: z.array(OperatingHourResponseSchema),
  surgeRules: z.array(SurgeRuleResponseSchema),
  serviceOverrides: z.array(BranchServiceOverrideWithServiceSchema),
});

export const EmergencyCloseResultSchema = z.object({
  branch: BranchScalarSchema,
  queueCancelled: z.number().int(),
  bookingsCancelled: z.number().int(),
});

export const BranchHolidaySchema = z.object({
  id: z.string(),
  branchId: z.string(),
  organizationId: z.string(),
  date: z.string(),
  name: z.string(),
  isClosed: z.boolean(),
  openTime: z.string().nullable(),
  closeTime: z.string().nullable(),
  createdAt: z.string(),
});

// ============================================================================
// Types
// ============================================================================

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type SetOperatingHoursInput = z.infer<typeof setOperatingHoursSchema>;
export type CreateSurgeRuleInput = z.infer<typeof createSurgeRuleSchema>;
export type UpdateSurgeRuleInput = z.infer<typeof updateSurgeRuleSchema>;
export type CreateBranchHolidayInput = z.infer<typeof createBranchHolidaySchema>;
export type UpdateBranchHolidayInput = z.infer<typeof updateBranchHolidaySchema>;
