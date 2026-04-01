import { z } from "zod";
import { createSuccessSchema } from "../../utils/openapi";
import { AnomSeverityEnum, AnomalyTypeEnum } from "../../utils/zod-prisma";

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

export const utilizationQuery = z.object({
  branchId: z.string().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

const globalDashboardBranchSchema = z.object({
  branchId: z.string(),
  branchName: z.string(),
  isOpen: z.boolean(),
  revenue: z.number(),
  transactionCount: z.number(),
  activeBarbers: z.number(),
  queueLength: z.number(),
  avgRating: z.number(),
});

const globalDashboardTotalsSchema = z.object({
  totalRevenue: z.number(),
  totalTransactions: z.number(),
  totalActiveBarbers: z.number(),
  totalQueueEntries: z.number(),
});

const globalDashboardAlertSchema = z.object({
  type: AnomalyTypeEnum,
  branchId: z.string(),
  branchName: z.string(),
  message: z.string(),
  severity: AnomSeverityEnum,
  createdAt: z.string(),
});

const globalDashboardDataSchema = z.object({
  date: z.string(),
  branches: z.array(globalDashboardBranchSchema),
  totals: globalDashboardTotalsSchema,
  alerts: z.array(globalDashboardAlertSchema),
});

export const globalDashboardSuccessSchema = createSuccessSchema(globalDashboardDataSchema);

const branchComparisonDataPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

const branchComparisonBranchSchema = z.object({
  branchId: z.string(),
  branchName: z.string(),
  dataPoints: z.array(branchComparisonDataPointSchema),
  total: z.number(),
  average: z.number(),
});

export const branchComparisonSuccessSchema = createSuccessSchema(z.array(branchComparisonBranchSchema));

const peakHeatmapDataSchema = z.object({
  heatmap: z.array(z.array(z.number())),
  peakDay: z.number(),
  peakHour: z.number(),
  peakValue: z.number(),
});

export const peakHeatmapSuccessSchema = createSuccessSchema(peakHeatmapDataSchema);

const retentionReturnRateSchema = z.object({
  month: z.number(),
  rate: z.number(),
});

const retentionDataSchema = z.object({
  cohortSize: z.number(),
  returnRates: z.array(retentionReturnRateSchema),
});

export const retentionSuccessSchema = createSuccessSchema(retentionDataSchema);

const revenueMonthPointSchema = z.object({
  month: z.string(),
  revenue: z.number(),
});

const revenueForecastDataSchema = z.object({
  historical: z.array(revenueMonthPointSchema),
  forecast: z.array(revenueMonthPointSchema),
  slope: z.number(),
  intercept: z.number(),
});

export const revenueForecastSuccessSchema = createSuccessSchema(revenueForecastDataSchema);

const utilizationBarberSchema = z.object({
  staffProfileId: z.string(),
  name: z.string(),
  availableMinutes: z.number(),
  busyMinutes: z.number(),
  servicesCount: z.number(),
  utilizationRate: z.number(),
});

const utilizationDataSchema = z.object({
  overallRate: z.number(),
  totalAvailableMinutes: z.number(),
  totalBusyMinutes: z.number(),
  barbers: z.array(utilizationBarberSchema),
});

export const utilizationSuccessSchema = createSuccessSchema(utilizationDataSchema);

const computeSnapshotsDataSchema = z.object({
  branchesProcessed: z.number(),
  date: z.string(),
});

export const computeSnapshotsSuccessSchema = createSuccessSchema(computeSnapshotsDataSchema);

export const revenueTrendQuery = z.object({
  branchId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

const revenueTrendPointSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  transactions: z.number(),
});

export const revenueTrendSuccessSchema = createSuccessSchema(z.array(revenueTrendPointSchema));
