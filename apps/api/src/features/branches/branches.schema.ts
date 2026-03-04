import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const DayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

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

export const TipDistributionEnum = z.enum(["PER_STAFF", "POOLED"]);

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
// Types
// ============================================================================

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type SetOperatingHoursInput = z.infer<typeof setOperatingHoursSchema>;
export type CreateSurgeRuleInput = z.infer<typeof createSurgeRuleSchema>;
export type UpdateSurgeRuleInput = z.infer<typeof updateSurgeRuleSchema>;
export type CreateBranchHolidayInput = z.infer<typeof createBranchHolidaySchema>;
export type UpdateBranchHolidayInput = z.infer<typeof updateBranchHolidaySchema>;
