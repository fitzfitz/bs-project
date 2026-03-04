import { z } from "zod";

export const PaymentMethodEnum = z.enum(["CASH", "CARD", "QRIS", "DIGITAL_WALLET"]);
export const TransactionStatusEnum = z.enum(["PENDING", "COMPLETED", "VOIDED", "REFUNDED"]);

export const createTransactionSchema = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
  queueEntryId: z.string().optional(),
  staffProfileId: z.string().optional(),
  customerId: z.string().optional(),
  items: z.array(
    z.object({
      serviceId: z.string().optional(),
      productId: z.string().optional(),
      name: z.string().min(1, "Item name is required"),
      quantity: z.number().int().min(1).default(1),
      unitPrice: z.number().min(0, "Unit price cannot be negative"),
      discount: z.number().min(0).default(0),
      isAddOn: z.boolean().default(false),
    })
  ).min(1, "Transaction must have at least one item"),
  tipAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  promoCode: z.string().optional(),
  loyaltyPointsUsed: z.number().int().min(0).default(0),
  clientUuid: z.string().uuid().optional(), // For offline dedup
});

export const addPaymentsSchema = z.object({
  payments: z.array(
    z.object({
      method: PaymentMethodEnum,
      amount: z.number().min(0, "Payment amount cannot be negative"),
      reference: z.string().optional(), // Gateway chargeId
    })
  ).min(1, "At least one payment must be provided"),
});

export const voidTransactionSchema = z.object({
  reason: z.string().min(5, "A reason of at least 5 characters is required for voiding"),
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

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type AddPaymentsInput = z.infer<typeof addPaymentsSchema>;
export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ReceiptData = z.infer<typeof ReceiptDataSchema>;
