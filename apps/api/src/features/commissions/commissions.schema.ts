import { z } from "zod";

export const calculateCommissionSchema = z.object({
  staffProfileId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export const recalculateDaySchema = z.object({
  staffProfileId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export const listEarningsQuerySchema = z.object({
  staffProfileId: z.string().min(1).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const staffProfileIdParamSchema = z.object({
  staffProfileId: z.string().min(1),
});

export const StaffEarningSchema = z.object({
  id: z.string(),
  staffProfileId: z.string(),
  date: z.string(),
  commissionBase: z.number(),
  commission: z.number(),
  tips: z.number(),
  total: z.number(),
  createdAt: z.string(),
});

export type CalculateCommissionInput = z.infer<typeof calculateCommissionSchema>;
export type RecalculateDayInput = z.infer<typeof recalculateDaySchema>;
export type ListEarningsQuery = z.infer<typeof listEarningsQuerySchema>;
