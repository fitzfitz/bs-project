import { z } from "@hono/zod-openapi";
import {
  TransactionStatusEnum,
  PaymentMethodEnum,
  DiscountTypeEnum,
  StaffTierEnum,
  StaffStatusEnum,
  QueueSourceEnum,
  QueueStatusEnum,
  TipDistributionEnum,
  ServiceTypeEnum,
} from "../../utils/zod-prisma";
import { createSuccessSchema, createPaginatedSuccessSchema } from "../../utils/openapi";

export const createTransactionSchema = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
  queueEntryId: z.string().optional(),
  staffProfileId: z.string().optional(),
  customerId: z.string().optional(),
  items: z
    .array(
      z.object({
        serviceId: z.string().optional(),
        productId: z.string().optional(),
        name: z.string().min(1, "Item name is required"),
        quantity: z.number().int().min(1).default(1),
        unitPrice: z.number().min(0, "Unit price cannot be negative"),
        discount: z.number().min(0).default(0),
        isAddOn: z.boolean().default(false),
      }),
    )
    .min(1, "Transaction must have at least one item"),
  tipAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  promoCode: z.string().optional(),
  loyaltyPointsUsed: z.number().int().min(0).default(0),
  clientUuid: z.string().uuid().optional(), // For offline dedup
});

export const addPaymentsSchema = z.object({
  payments: z
    .array(
      z.object({
        method: PaymentMethodEnum,
        amount: z.number().min(0, "Payment amount cannot be negative"),
        reference: z.string().optional(), // Gateway chargeId
      }),
    )
    .min(1, "At least one payment must be provided"),
});

export const voidTransactionSchema = z.object({
  reason: z.string().min(5, "A reason of at least 5 characters is required for voiding"),
});

export const refundTransactionSchema = z.object({
  reason: z.string().min(5, "A reason of at least 5 characters is required for refunding"),
});

export const listTransactionsQuerySchema = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
  queueEntryId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: TransactionStatusEnum.optional(),
  staffProfileId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// -----------------------------------------------------------------------------
// Response shapes (aligned with Prisma + TransactionService)
// -----------------------------------------------------------------------------

/** Optional queue staff expansion (relation not always loaded). */
export const QueueStaffProfileRefSchema = z.object({
  id: z.string(),
  tier: StaffTierEnum,
  status: StaffStatusEnum,
});

export const QueueEntryResponseSchema = z.object({
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
  calledAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  staffProfile: QueueStaffProfileRefSchema.optional(),
});

export const TransactionItemSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  serviceId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  organizationId: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  total: z.number(),
  isAddOn: z.boolean(),
});

export const PaymentResponseSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  organizationId: z.string(),
  method: PaymentMethodEnum,
  amount: z.number(),
  reference: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const TransactionScalarSchema = z.object({
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
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Couples transaction OpenAPI to Prisma `DiscountType` (promo / line discount domain). */
export type TransactionDiscountType = z.infer<typeof DiscountTypeEnum>;

export const ServiceNestedSchema = z.object({
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
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProductNestedSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullable().optional(),
  costPrice: z.number(),
  sellPrice: z.number(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TransactionItemWithRelationsSchema = TransactionItemSchema.extend({
  service: ServiceNestedSchema.nullable().optional(),
  product: ProductNestedSchema.nullable().optional(),
});

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
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** POST / — create (items omitted when idempotent clientUuid hit returns existing row). */
export const CreateTransactionDataSchema = TransactionScalarSchema.extend({
  items: z.array(TransactionItemSchema).optional(),
});

/** POST /:id/pay — completed transaction with line items and payments. */
export const TransactionWithItemsAndPaymentsSchema = TransactionScalarSchema.extend({
  items: z.array(TransactionItemSchema),
  payments: z.array(PaymentResponseSchema),
});

/** GET / — list row. */
export const TransactionListRowSchema = TransactionScalarSchema.extend({
  items: z.array(TransactionItemSchema),
  payments: z.array(PaymentResponseSchema),
  queueEntry: QueueEntryResponseSchema.nullable().optional(),
});

/** GET /:id — detail. */
export const TransactionDetailSchema = TransactionScalarSchema.extend({
  items: z.array(TransactionItemWithRelationsSchema),
  payments: z.array(PaymentResponseSchema),
  queueEntry: QueueEntryResponseSchema.nullable().optional(),
  branch: BranchResponseSchema,
});

/** GET /summary — matches TransactionService.getDailySummary. */
export const DailySummarySchema = z.object({
  count: z.number().int(),
  totalRevenue: z.number(),
  totalServiceRevenue: z.number(),
  totalProductRevenue: z.number(),
  totalTips: z.number(),
  paymentMethods: z.object({
    CASH: z.number(),
    CARD: z.number(),
    QRIS: z.number(),
    DIGITAL_WALLET: z.number(),
  }),
});

export const ReceiptItemSchema = z.object({
  name: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  discount: z.number(),
  total: z.number(),
});

export const ReceiptPaymentSchema = z.object({
  method: z.string(),
  amount: z.number(),
});

export const ReceiptDataSchema = z.object({
  receiptNumber: z.string(),
  date: z.string(),
  branchId: z.string(),
  branchName: z.string(),
  branchAddress: z.string(),
  cashierName: z.string(),
  staffProfileId: z.string().nullable(),
  staffName: z.string().nullable(),
  queueEntryId: z.string().nullable(),
  items: z.array(ReceiptItemSchema),
  subtotal: z.number(),
  discountTotal: z.number(),
  tax: z.number(),
  tip: z.number(),
  grandTotal: z.number(),
  payments: z.array(ReceiptPaymentSchema),
  loyaltyPointsEarned: z.number(),
});

// -----------------------------------------------------------------------------
// OpenAPI wrappers
// -----------------------------------------------------------------------------

export const createTransaction201Schema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string(),
  data: CreateTransactionDataSchema,
});

export const addPayments200Schema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string(),
  data: TransactionWithItemsAndPaymentsSchema,
});

export const voidTransaction200Schema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string(),
  data: TransactionScalarSchema,
});

export const refundTransaction200Schema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string(),
  data: TransactionScalarSchema,
});

export const listTransactions200Schema = createPaginatedSuccessSchema(TransactionListRowSchema);

export const getDailySummary200Schema = createSuccessSchema(DailySummarySchema);

export const getTransactionById200Schema = createSuccessSchema(TransactionDetailSchema);

export const getReceipt200Schema = createSuccessSchema(ReceiptDataSchema);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type AddPaymentsInput = z.infer<typeof addPaymentsSchema>;
export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
export type RefundTransactionInput = z.infer<typeof refundTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ReceiptData = z.infer<typeof ReceiptDataSchema>;
