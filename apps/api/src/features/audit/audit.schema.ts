import { z } from "@hono/zod-openapi";

export const auditLogQuery = z.object({
  branchId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("50"),
});

export const anomalyQuery = z.object({
  branchId: z.string().optional(),
  type: z.string().optional(),
  severity: z.string().optional(),
  isResolved: z.string().optional(),
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
});

export const resolveAnomalySchema = z.object({
  notes: z.string().optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuery>;
export type AnomalyQueryInput = z.infer<typeof anomalyQuery>;
