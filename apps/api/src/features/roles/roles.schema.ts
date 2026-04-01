import { z } from "zod";
import {
  FeatureModuleEnum,
  RoleScopeEnum,
  ServiceTypeEnum,
} from "../../utils/zod-prisma";

// ============================================================================
// Response / entity schemas
// ============================================================================

export const TenantRoleSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  scope: RoleScopeEnum,
  isDefault: z.boolean(),
  isSystemRole: z.boolean(),
  isServiceProvider: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TenantRoleListCountSchema = z.object({
  users: z.number(),
  permissions: z.number(),
});

export const TenantRoleListItemSchema = TenantRoleSchema.extend({
  _count: TenantRoleListCountSchema,
});

export const FeatureSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  module: FeatureModuleEnum,
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const TenantRolePermissionSchema = z.object({
  id: z.string(),
  tenantRoleId: z.string(),
  featureCode: z.string(),
  canCreate: z.boolean(),
  canRead: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
});

/** Permission row with feature snippet as returned by get/set permission matrix. */
export const PermissionMatrixEntrySchema = TenantRolePermissionSchema.extend({
  feature: z.object({
    code: z.string(),
    name: z.string(),
    module: FeatureModuleEnum,
  }),
});

/** Full service entity (catalog); role routes return a subset on assignments. */
export const ServiceSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  type: ServiceTypeEnum,
  basePrice: z.number(),
  durationMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
  isCommissionable: z.boolean(),
  loyaltyEligible: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RoleAssignedServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
});

export const RoleServiceEntrySchema = z.object({
  id: z.string(),
  tenantRoleId: z.string(),
  serviceId: z.string(),
  organizationId: z.string(),
  service: RoleAssignedServiceSchema,
});

export const TenantRoleDetailCountSchema = z.object({
  users: z.number(),
  permissions: z.number(),
  roleServices: z.number(),
});

/** Full role with aggregates and relations (e.g. detail views). */
export const TenantRoleDetailSchema = TenantRoleSchema.extend({
  _count: TenantRoleDetailCountSchema,
  permissions: z.array(PermissionMatrixEntrySchema),
  roleServices: z.array(RoleServiceEntrySchema),
});

// ============================================================================
// Request schemas
// ============================================================================

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  scope: RoleScopeEnum,
  isServiceProvider: z.boolean().default(false),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  scope: RoleScopeEnum.optional(),
  isServiceProvider: z.boolean().optional(),
});

export const permissionMatrixSchema = z.array(
  z.object({
    featureCode: z.string(),
    canCreate: z.boolean(),
    canRead: z.boolean(),
    canUpdate: z.boolean(),
    canDelete: z.boolean(),
  })
);

export const roleServicesSchema = z.object({
  serviceIds: z.array(z.string()),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type PermissionMatrixInput = z.infer<typeof permissionMatrixSchema>;
export type RoleServicesInput = z.infer<typeof roleServicesSchema>;
