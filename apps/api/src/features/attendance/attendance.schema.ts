import { z } from "@hono/zod-openapi";
import {
  AuthProviderEnum,
  CommissionModelEnum,
  StaffStatusEnum,
  StaffTierEnum,
} from "../../utils/zod-prisma";

// ============================================================================
// Attendance Schemas
// ============================================================================

export const clockInSchema = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
});

export const clockOutSchema = z.object({
  notes: z.string().optional(),
});

export const attendanceIdParam = z.object({
  id: z.string().min(1),
});

export const listAttendanceQuery = z.object({
  staffProfileId: z.string().optional(),
  branchId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// Shift / Block Schemas
// ============================================================================

export const ShiftTypeEnum = z.enum(["WORKING", "BREAK", "LEAVE", "TRAINING"]);

export const createShiftBlockSchema = z.object({
  staffProfileId: z.string().min(1, "Staff profile ID is required"),
  branchId: z.string().optional(), // Nullable for leave/training
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:00)?$/, "Must be HH:mm format"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:00)?$/, "Must be HH:mm format"),
  notes: z.string().optional(),
});

export const updateShiftBlockSchema = createShiftBlockSchema.partial();

export const shiftBlockIdParam = z.object({
  id: z.string().min(1),
});

export const listShiftsQuery = z.object({
  staffProfileId: z.string().optional(),
  branchId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
});

// ============================================================================
// API response shapes (match Prisma JSON serialization)
// ============================================================================

export const AttendanceUserNestedSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  tenantRoleId: z.string(),
  branchId: z.string().nullable().optional(),
  email: z.string(),
  passwordHash: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  avatar: z.string().nullable().optional(),
  isCustomer: z.boolean(),
  isActive: z.boolean(),
  authProvider: AuthProviderEnum,
  googleId: z.string().nullable().optional(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StaffProfileWithUserSchema = z.object({
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
  totalReviews: z.number(),
  user: AttendanceUserNestedSchema,
});

export const AttendanceScalarSchema = z.object({
  id: z.string(),
  staffProfileId: z.string(),
  organizationId: z.string(),
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().nullable().optional(),
  autoClockOut: z.boolean(),
  createdAt: z.string().datetime(),
});

export const AttendanceWithStaffSchema = AttendanceScalarSchema.extend({
  staff: StaffProfileWithUserSchema,
});

export const ShiftScheduleScalarSchema = z.object({
  id: z.string(),
  staffProfileId: z.string(),
  organizationId: z.string(),
  date: z.string().datetime(),
  startTime: z.string(),
  endTime: z.string(),
  isLeave: z.boolean(),
  note: z.string().nullable().optional(),
});

export const ShiftScheduleWithStaffSchema = ShiftScheduleScalarSchema.extend({
  staff: StaffProfileWithUserSchema,
});

// ============================================================================
// Types
// ============================================================================

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type CreateShiftBlockInput = z.infer<typeof createShiftBlockSchema>;
export type UpdateShiftBlockInput = z.infer<typeof updateShiftBlockSchema>;
