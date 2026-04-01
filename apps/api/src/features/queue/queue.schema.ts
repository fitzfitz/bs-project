import { z } from "zod";
import {
  QueueSourceEnum,
  QueueStatusEnum,
  BookingStatusEnum,
  ServiceTypeEnum,
  TransactionStatusEnum,
} from "../../utils/zod-prisma";
import {
  BranchResponseSchema,
  StaffProfileWithUserSchema,
} from "../staff/staff.schema";

// ============================================================================
// Enums (aligned with Prisma)
// ============================================================================

/** Same values as Prisma `QueueSource` — used on booking/queue create body. */
export const BookingSourceEnum = QueueSourceEnum;

export { QueueStatusEnum, QueueSourceEnum };

// ============================================================================
// Queue / Booking request schemas
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

export const prepayBody = z.object({
  successRedirectUrl: z.string().url(),
  failureRedirectUrl: z.string().url(),
});

export const prepayResponseData = z.object({
  invoiceId: z.string(),
  invoiceUrl: z.string(),
  amount: z.number(),
});

// ============================================================================
// Response schemas (OpenAPI)
// ============================================================================

const dateWire = z.union([z.string(), z.coerce.date()]);

export const QueueEntryScalarSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  branchId: z.string(),
  staffProfileId: z.string().nullable().optional(),
  bookingId: z.string().nullable().optional(),
  source: QueueSourceEnum,
  status: QueueStatusEnum,
  position: z.number().int(),
  customerName: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  estimatedWait: z.number().int().nullable().optional(),
  calledAt: dateWire.nullable().optional(),
  startedAt: dateWire.nullable().optional(),
  completedAt: dateWire.nullable().optional(),
  createdAt: dateWire,
  updatedAt: dateWire,
});

export const QueueStaffListSchema = z.object({
  id: z.string(),
  user: z.object({
    firstName: z.string(),
    lastName: z.string(),
  }),
});

export const QueueBookingServiceTrimSchema = z.object({
  name: z.string(),
  durationMinutes: z.number().int(),
  basePrice: z.number(),
});

export const QueueBookingListItemSchema = z.object({
  id: z.string(),
  scheduledAt: dateWire,
  note: z.string().nullable(),
  totalDuration: z.number().int(),
  items: z.array(
    z.object({
      service: QueueBookingServiceTrimSchema,
    }),
  ),
});

/** `listQueue` rows: scalars + trimmed staff + trimmed booking */
export const QueueEntryListItemSchema = QueueEntryScalarSchema.extend({
  staff: QueueStaffListSchema.nullable(),
  booking: QueueBookingListItemSchema.nullable(),
});

export const QueueServiceFullSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  type: ServiceTypeEnum,
  basePrice: z.number(),
  durationMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
  isCommissionable: z.boolean(),
  loyaltyEligible: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: dateWire,
  updatedAt: dateWire,
});

export const QueueBookingItemSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  serviceId: z.string(),
  organizationId: z.string(),
  price: z.number(),
  isAddOn: z.boolean(),
  service: QueueServiceFullSchema,
});

export const QueueBookingDetailSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  customerId: z.string(),
  branchId: z.string(),
  staffProfileId: z.string().nullable().optional(),
  status: BookingStatusEnum,
  scheduledAt: dateWire,
  totalDuration: z.number().int(),
  note: z.string().nullable().optional(),
  cancelledAt: dateWire.nullable().optional(),
  createdAt: dateWire,
  updatedAt: dateWire,
  items: z.array(QueueBookingItemSchema),
});

export const QueueTransactionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  branchId: z.string(),
  queueEntryId: z.string().nullable().optional(),
  staffProfileId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  grossAmount: z.number(),
  discountAmount: z.number(),
  taxAmount: z.number(),
  tipAmount: z.number(),
  netAmount: z.number(),
  totalDue: z.number(),
  loyaltyPointsUsed: z.number().int(),
  loyaltyPointsEarned: z.number().int(),
  promoCode: z.string().nullable().optional(),
  status: TransactionStatusEnum,
  clientUuid: z.string().nullable().optional(),
  createdAt: dateWire,
  updatedAt: dateWire,
});

/** `GET /queue/me` — full branch, staff+user, booking+items+service, optional transaction */
export const QueueEntryUserViewSchema = QueueEntryScalarSchema.extend({
  branch: BranchResponseSchema,
  staff: StaffProfileWithUserSchema.nullable(),
  booking: QueueBookingDetailSchema.nullable(),
  transaction: QueueTransactionSchema.nullable().optional(),
});

/** `GET /queue/:id` — scalars + full staff+user + full booking */
export const QueueEntryDetailSchema = QueueEntryScalarSchema.extend({
  staff: StaffProfileWithUserSchema.nullable(),
  booking: QueueBookingDetailSchema.nullable(),
});

// ============================================================================
// Types (requests)
// ============================================================================

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateQueueStatusInput = z.infer<typeof updateQueueStatusSchema>;
export type AssignStaffToQueueInput = z.infer<
  typeof assignStaffToQueueSchema
>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
