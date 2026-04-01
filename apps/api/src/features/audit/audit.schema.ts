import { z } from "@hono/zod-openapi";
import {
  AnomSeverityEnum,
  AnomalyTypeEnum,
  AuditActionEnum,
  BranchSummarySchema,
  RoleScopeEnum,
  UserSummarySchema,
  UserSummaryWithEmailSchema,
} from "../../utils/zod-prisma";

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

const AuditLogUserNestedSchema = UserSummaryWithEmailSchema.extend({
  tenantRole: z.object({
    name: z.string(),
    scope: RoleScopeEnum,
  }),
});

export const AuditLogResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable().optional(),
  tenantRoleId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  action: AuditActionEnum,
  entityType: z.string(),
  entityId: z.string(),
  details: z.unknown().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  user: AuditLogUserNestedSchema.nullable(),
  branch: BranchSummarySchema.nullable(),
});

export const AnomalyFlagResponseSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable().optional(),
  type: AnomalyTypeEnum,
  severity: AnomSeverityEnum,
  details: z.unknown(),
  isResolved: z.boolean(),
  resolvedBy: z.string().nullable().optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  branch: BranchSummarySchema,
  user: UserSummaryWithEmailSchema.nullable(),
});

export const AnomalyStatsSchema = z.object({
  total: z.number(),
  unresolved: z.number(),
  bySeverity: z.array(
    z.object({
      severity: AnomSeverityEnum,
      count: z.number(),
    }),
  ),
  byType: z.array(
    z.object({
      type: AnomalyTypeEnum,
      count: z.number(),
    }),
  ),
});

export const AnomalyResolvedSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable().optional(),
  type: AnomalyTypeEnum,
  severity: AnomSeverityEnum,
  details: z.unknown(),
  isResolved: z.boolean(),
  resolvedBy: z.string().nullable().optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  branch: BranchSummarySchema,
  user: UserSummarySchema.nullable(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuery>;
export type AnomalyQueryInput = z.infer<typeof anomalyQuery>;
