import { z } from "zod";

export const plSummaryQuery = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  branchId: z.string().optional(),
});

export const voidDiscountAuditQuery = z.object({
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const payrollOversightQuery = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.string().optional(),
});

export const taxSummaryQuery = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  branchId: z.string().optional(),
});
