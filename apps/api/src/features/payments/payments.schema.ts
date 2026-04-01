import { z } from "zod";

/** Xendit webhook callback body (subset we use). */
export const xenditWebhookBodySchema = z.object({
  id: z.string(),
  external_id: z.string(),
  status: z.string(),
});

export const createChargeSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  successRedirectUrl: z.string().url("Valid success redirect URL is required"),
  failureRedirectUrl: z.string().url("Valid failure redirect URL is required"),
});

export const savePaymentMethodSchema = z.object({
  tokenId: z.string().min(1, "Token ID is required"),
  type: z.string().default("CARD"),
  last4: z.string().length(4, "Last 4 digits required"),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(2025),
  isDefault: z.boolean().default(false),
});

export const paymentMethodIdParam = z.object({
  id: z.string().min(1),
});
