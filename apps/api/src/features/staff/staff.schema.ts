import { z } from "zod";
import { StaffTierEnum } from "../services/services.schema";

export const StaffStatusEnum = z.enum([
  "AVAILABLE",
  "BUSY",
  "ON_BREAK",
  "RESERVED",
  "OFF_DUTY",
]);

export const CommissionModelEnum = z.enum([
  "FLAT_PERCENTAGE",
  "SLIDING_SCALE",
  "BASE_PLUS_BONUS",
]);

export const createStaffProfileSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  bio: z.string().optional(),
  tier: StaffTierEnum.default("JUNIOR"),
  specialties: z.array(z.string()).default([]),
  commissionModel: CommissionModelEnum.default("FLAT_PERCENTAGE"),
  commissionRate: z.number().min(0).max(1).default(0.4),
  baseSalary: z.number().min(0).default(0),
  bonusRate: z.number().min(0).max(1).optional(),
});

export const updateStaffProfileSchema = createStaffProfileSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    status: StaffStatusEnum.optional(),
  });

export const staffIdParam = z.object({
  id: z.string().min(1),
});

export const listStaffQuery = z.object({
  branchId: z.string().optional(),
  tier: StaffTierEnum.optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const assignStaffSchema = z.object({
  branchId: z.string().min(1),
});

export type CreateStaffProfileInput = z.infer<typeof createStaffProfileSchema>;
export type UpdateStaffProfileInput = z.infer<typeof updateStaffProfileSchema>;
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;
