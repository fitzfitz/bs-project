import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const QueueStatusEnum = z.enum([
  "WAITING",
  "CALLED",
  "IN_SERVICE",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "AT_CHECKOUT",
  "PAID",
]);

export const BookingSourceEnum = z.enum(["APP", "WEB", "WALK_IN"]);

// ============================================================================
// Queue / Booking Schemas
// ============================================================================

export const createBookingSchema = z.object({
  customerId: z.string().optional(), // Nullable for walk-ins without accounts
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().optional(),
  branchId: z.string().min(1, "Branch ID is required"),
  staffProfileId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1, "At least one service required"),
  startTime: z.string().datetime(),
  estimatedDuration: z.number().int().positive(),
  source: BookingSourceEnum.default("WALK_IN"),
  notes: z.string().optional(),
});

export const updateQueueStatusSchema = z.object({
  status: QueueStatusEnum,
});

export const assignStaffToQueueSchema = z.object({
  staffProfileId: z.string().min(1, "Staff profile ID is required"),
});

export const postponeQueueSchema = z.object({
  minutes: z.number().int().positive().default(10),
});

export const entryIdParam = z.object({
  id: z.string().min(1),
});

export const listQueueQuery = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(), // Defaults to today
  staffProfileId: z.string().optional(),
  status: QueueStatusEnum.optional(),
});

export const rescheduleSchema = z.object({
  startTime: z.string().datetime(),
});

// ============================================================================
// Types
// ============================================================================

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateQueueStatusInput = z.infer<typeof updateQueueStatusSchema>;
export type AssignStaffToQueueInput = z.infer<
  typeof assignStaffToQueueSchema
>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
