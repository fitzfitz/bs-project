import { z } from "@hono/zod-openapi";

export const reportTypeEnum = z.enum([
  "daily_revenue",
  "service_popularity",
  "barber_leaderboard",
  "staff_leaderboard",
  "customer_visits",
  "booking_source",
]);

export const generateReportQuery = z.object({
  type: reportTypeEnum,
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const exportCsvQuery = z.object({
  type: reportTypeEnum,
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const exportPdfQuery = z.object({
  type: reportTypeEnum,
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const ReportDataResponseSchema = z.object({
  type: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  generatedAt: z.string(),
});

export const reportFrequencyEnum = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);

export const createScheduleBody = z.object({
  reportType: reportTypeEnum,
  branchId: z.string().optional(),
  frequency: reportFrequencyEnum,
  recipients: z.array(z.string().min(1)).min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const updateScheduleBody = z.object({
  frequency: reportFrequencyEnum.optional(),
  recipients: z.array(z.string().min(1)).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const scheduleIdParam = z.object({
  id: z.string().min(1),
});

export const createTemplateBody = z.object({
  name: z.string().min(1),
  reportType: reportTypeEnum,
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const templateIdParam = z.object({
  id: z.string().min(1),
});

export const ReportScheduleResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  branchId: z.string().nullable(),
  reportType: z.string(),
  frequency: reportFrequencyEnum,
  recipients: z.array(z.string()),
  filters: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  lastSentAt: z.string().nullable(),
  nextRunAt: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SavedReportTemplateResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  reportType: z.string(),
  filters: z.record(z.string(), z.unknown()),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
