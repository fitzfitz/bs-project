import { z } from "zod";
import { createSuccessSchema } from "../../utils/openapi";
import {
  AuditActionEnum,
  CommissionModelEnum,
  PayrollStatusEnum,
  RoleScopeEnum,
  StaffStatusEnum,
  StaffTierEnum,
} from "../../utils/zod-prisma";

// ---------------------------------------------------------------------------
// Response data shapes (FinanceService)
// ---------------------------------------------------------------------------

export const plSummaryDataSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  revenue: z.object({
    serviceRevenue: z.number(),
    productRevenue: z.number(),
    tipsCollected: z.number(),
    totalRevenue: z.number(),
  }),
  costs: z.object({
    totalCommissions: z.number(),
    totalPayroll: z.number(),
    inventoryCOGS: z.number(),
    totalCosts: z.number(),
  }),
  grossProfit: z.number(),
  margins: z.object({ grossMarginPercent: z.number() }),
  taxes: z.object({ ppnCollected: z.number() }),
  discountsGiven: z.number(),
  voidsTotal: z.number(),
  refundsTotal: z.number(),
});

export const financeAuditLogUserSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    tenantRole: z
      .object({
        scope: RoleScopeEnum,
      })
      .nullable(),
  })
  .nullable();

export const financeAuditLogSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable(),
  tenantRoleId: z.string().nullable(),
  branchId: z.string().nullable(),
  action: AuditActionEnum,
  entityType: z.string(),
  entityId: z.string(),
  details: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.union([z.string(), z.coerce.date()]),
  user: financeAuditLogUserSchema,
});

export const voidDiscountAuditDataSchema = z.object({
  voids: z.array(financeAuditLogSchema),
  refunds: z.array(financeAuditLogSchema),
  discounts: z.array(financeAuditLogSchema),
  voidTotal: z.number(),
  refundTotal: z.number(),
  discountTotal: z.number(),
});

export const payrollOversightStaffUserSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
});

export const payrollOversightStaffProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  bio: z.string().nullable(),
  specialties: z.array(z.string()),
  tier: StaffTierEnum,
  status: StaffStatusEnum,
  commissionModel: CommissionModelEnum,
  commissionRate: z.number(),
  baseSalary: z.number().nullable(),
  bonusRate: z.number().nullable(),
  averageRating: z.number(),
  totalReviews: z.number(),
  user: payrollOversightStaffUserSchema,
});

export const payrollOversightPeriodSchema = z.object({
  id: z.string(),
  staffProfileId: z.string(),
  organizationId: z.string(),
  periodStart: z.union([z.string(), z.coerce.date()]),
  periodEnd: z.union([z.string(), z.coerce.date()]),
  totalCommission: z.number(),
  totalTips: z.number(),
  totalPayout: z.number(),
  status: PayrollStatusEnum,
  approvedBy: z.string().nullable(),
  approvedAt: z.union([z.string(), z.coerce.date()]).nullable(),
  note: z.string().nullable(),
  createdAt: z.union([z.string(), z.coerce.date()]),
  updatedAt: z.union([z.string(), z.coerce.date()]),
  staff: payrollOversightStaffProfileSchema,
});

export const taxSummaryDataSchema = z.object({
  totalTax: z.number(),
  totalNetRevenue: z.number(),
  transactionCount: z.number(),
  period: z.object({ from: z.string(), to: z.string() }),
});

// ---------------------------------------------------------------------------
// OpenAPI 200 response wrappers
// ---------------------------------------------------------------------------

export const plSummarySuccessSchema = createSuccessSchema(plSummaryDataSchema);
export const voidDiscountAuditSuccessSchema = createSuccessSchema(voidDiscountAuditDataSchema);
export const payrollOversightSuccessSchema = createSuccessSchema(
  z.array(payrollOversightPeriodSchema),
);
export const taxSummarySuccessSchema = createSuccessSchema(taxSummaryDataSchema);

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
