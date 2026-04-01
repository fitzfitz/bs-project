import { z } from "zod";
import {
  FeatureModuleEnum,
  IndustryTypeEnum,
  PlatformRoleEnum,
  RoleScopeEnum,
  TipDistributionEnum,
} from "../../utils/zod-prisma";

// ============================================================================
// Response / OpenAPI shapes
// ============================================================================

/** Safe platform admin (login); excludes passwordHash. */
export const PlatformAdminResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: PlatformRoleEnum,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PlatformLoginSuccessDataSchema = z.object({
  token: z.string(),
  admin: PlatformAdminResponseSchema,
});

export const OrganizationScalarsSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  industryType: IndustryTypeEnum,
  logo: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  taxEnabled: z.boolean(),
  taxRate: z.number(),
  taxName: z.string(),
  taxInclusive: z.boolean(),
  currency: z.string(),
  currencySymbol: z.string(),
  timezone: z.string(),
  locale: z.string(),
  tipDistribution: TipDistributionEnum,
  maxDiscountPercent: z.number(),
  autoNoShowMinutes: z.number(),
  autoClockOutTime: z.string().nullable().optional(),
  defaultBookingBuffer: z.number(),
  requireVoidApproval: z.boolean(),
  loyaltyEnabled: z.boolean(),
  loyaltyPointsPerCurrency: z.number(),
  loyaltyRedemptionRate: z.number(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const OrganizationCountSchema = z.object({
  users: z.number().int(),
  branches: z.number().int(),
});

export const OrganizationListItemSchema = OrganizationScalarsSchema.extend({
  _count: OrganizationCountSchema,
});

export const OrganizationBranchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export const OrganizationTenantRoleSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: RoleScopeEnum,
  isServiceProvider: z.boolean(),
});

/** GET /organizations/:id — org with branches, tenant roles, and counts. */
export const OrganizationDetailSchema = OrganizationScalarsSchema.extend({
  branches: z.array(OrganizationBranchSummarySchema),
  tenantRoles: z.array(OrganizationTenantRoleSummarySchema),
  _count: OrganizationCountSchema,
});

export const TenantRoleScalarSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  scope: RoleScopeEnum,
  isDefault: z.boolean(),
  isSystemRole: z.boolean(),
  isServiceProvider: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** POST /organizations — created org plus seeded tenant roles. */
export const OrganizationCreatedSchema = OrganizationScalarsSchema.extend({
  roles: z.array(TenantRoleScalarSchema),
});

export const FeatureResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  module: FeatureModuleEnum,
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export const IndustryTemplateSchema = z.object({
  id: z.string(),
  industryType: IndustryTypeEnum,
  name: z.string(),
  description: z.string().nullable().optional(),
  templateData: z.unknown(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PlatformConfigSchema = z.object({
  key: z.string(),
  value: z.string(),
  updatedBy: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  industry: z.enum([
    "BARBERSHOP", "VET_CLINIC", "MASSAGE", "NAIL_SALON", "SPA",
    "PET_GROOMING", "DENTAL_CLINIC", "AUTO_DETAILING", "BEAUTY_SALON",
    "TATTOO_PARLOR", "GENERAL_SERVICE",
  ]),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().min(1),
  ownerPassword: z.string().min(8),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  taxName: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const platformConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
