import { z } from "zod";

export const generatePeriodSchema = z.object({
  staffProfileId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const payrollIdParamSchema = z.object({
  id: z.string().min(1),
});

export const submitForApprovalSchema = z.object({});
export const approveSchema = z.object({
  note: z.string().optional(),
});
export const disputeSchema = z.object({
  note: z.string().min(1, "Dispute reason is required"),
});
export const resolveDisputeSchema = z.object({
  note: z.string().optional(),
});
export const markDisbursedSchema = z.object({
  note: z.string().optional(),
});

export const listPayrollQuerySchema = z.object({
  staffProfileId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "DISPUTED", "DISBURSED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PayrollStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "DISPUTED",
  "DISBURSED",
]);

export const PayrollPeriodSchema = z.object({
  id: z.string(),
  staffProfileId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalCommission: z.number(),
  totalTips: z.number(),
  totalPayout: z.number(),
  status: PayrollStatusEnum,
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GeneratePeriodInput = z.infer<typeof generatePeriodSchema>;
export type ListPayrollQuery = z.infer<typeof listPayrollQuerySchema>;
