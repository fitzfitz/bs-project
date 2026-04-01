import { z } from "zod";
import {
  StaffTierEnum,
  StaffStatusEnum,
  CommissionModelEnum,
  AuthProviderEnum,
  TipDistributionEnum,
} from "../../utils/zod-prisma";

export { StaffTierEnum, StaffStatusEnum, CommissionModelEnum };

const dateWire = z.union([z.string(), z.coerce.date()]);

export const BranchResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean(),
  isEmergencyClosed: z.boolean(),
  tipDistribution: TipDistributionEnum.nullable().optional(),
  maxDiscountPercent: z.number().nullable().optional(),
  averageRating: z.number(),
  totalReviews: z.number().int(),
  createdAt: dateWire,
  updatedAt: dateWire,
});

export const StaffUserSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  tenantRoleId: z.string(),
  branchId: z.string().nullable().optional(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  avatar: z.string().nullable().optional(),
  isCustomer: z.boolean(),
  isActive: z.boolean(),
  authProvider: AuthProviderEnum,
  googleId: z.string().nullable().optional(),
  emailVerified: z.boolean(),
  createdAt: dateWire,
  updatedAt: dateWire,
});

export const StaffProfileScalarSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  bio: z.string().nullable().optional(),
  specialties: z.array(z.string()),
  tier: StaffTierEnum,
  status: StaffStatusEnum,
  commissionModel: CommissionModelEnum,
  commissionRate: z.number(),
  baseSalary: z.number().nullable().optional(),
  bonusRate: z.number().nullable().optional(),
  averageRating: z.number(),
  totalReviews: z.number().int(),
});

export const StaffProfileWithUserSchema = StaffProfileScalarSchema.extend({
  user: StaffUserSchema,
});

export const StaffProfileWithUserAndBranchSchema = StaffProfileScalarSchema.extend({
  user: StaffUserSchema.extend({
    branch: BranchResponseSchema.nullable().optional(),
  }),
});

/** User row with optional branch (e.g. after assign-to-branch). */
export const UserWithBranchSchema = StaffUserSchema.extend({
  branch: BranchResponseSchema.nullable().optional(),
});

export const createStaffProfileSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  bio: z.string().optional(),
  tier: StaffTierEnum.default("JUNIOR"),
  specialties: z.array(z.string()).default([]),
  commissionModel: CommissionModelEnum.default("FLAT_PERCENTAGE"),
  commissionRate: z.number().min(0).max(1).optional(),
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
