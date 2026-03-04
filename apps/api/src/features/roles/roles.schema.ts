import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  scope: z.enum(["HQ", "BRANCH", "CUSTOMER"]),
  isServiceProvider: z.boolean().default(false),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  scope: z.enum(["HQ", "BRANCH", "CUSTOMER"]).optional(),
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
