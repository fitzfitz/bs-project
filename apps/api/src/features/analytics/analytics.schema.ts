import { z } from "zod";

export const globalDashboardQuery = z.object({
  date: z.string().optional(),
});

export const branchComparisonQuery = z.object({
  branchIds: z.string().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
  metric: z.enum(["revenue", "transactions", "avgTicket", "customerCount", "rating"]).default("revenue"),
});

export const peakHourQuery = z.object({
  branchId: z.string().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const retentionQuery = z.object({
  branchId: z.string().optional(),
  cohortMonth: z.string(),
});

export const forecastQuery = z.object({
  branchId: z.string(),
  periods: z.coerce.number().int().min(1).max(12).default(3),
});

export const computeSnapshotsBody = z.object({
  date: z.string().optional(),
});
