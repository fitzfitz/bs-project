import type { PrismaClient, RoleScope } from "@prisma/client";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  PermissionMatrixInput,
} from "./roles.schema";
import {
  invalidatePermissionCache,
  invalidateAllPermissionCaches,
} from "../../middlewares/rbac";

export const RolesService = {
  async listRoles(db: PrismaClient, organizationId: string) {
    return db.tenantRole.findMany({
      where: { organizationId },
      include: {
        _count: { select: { users: true, permissions: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async getRoleById(db: PrismaClient, id: string) {
    return db.tenantRole.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, permissions: true, roleServices: true } },
      },
    });
  },

  async createRole(
    db: PrismaClient,
    organizationId: string,
    data: CreateRoleInput
  ) {
    return db.tenantRole.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        scope: data.scope as RoleScope,
        isServiceProvider: data.isServiceProvider,
      },
    });
  },

  async updateRole(db: PrismaClient, id: string, data: UpdateRoleInput) {
    const role = await db.tenantRole.findUnique({ where: { id } });
    if (!role) throw new Error("Role not found");
    if (role.isSystemRole) {
      if (data.scope && data.scope !== role.scope) {
        throw new Error("Cannot change scope of a system role");
      }
    }

    return db.tenantRole.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.scope !== undefined ? { scope: data.scope as RoleScope } : {}),
        ...(data.isServiceProvider !== undefined
          ? { isServiceProvider: data.isServiceProvider }
          : {}),
      },
    });
  },

  async deleteRole(db: PrismaClient, id: string) {
    const role = await db.tenantRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new Error("Role not found");
    if (role.isSystemRole) throw new Error("Cannot delete a system role");
    if (role._count.users > 0) {
      throw new Error("Cannot delete role with assigned users. Reassign them first.");
    }

    await db.tenantRolePermission.deleteMany({ where: { tenantRoleId: id } });
    await db.tenantRoleService.deleteMany({ where: { tenantRoleId: id } });
    return db.tenantRole.delete({ where: { id } });
  },

  async getPermissionMatrix(db: PrismaClient, roleId: string) {
    return db.tenantRolePermission.findMany({
      where: { tenantRoleId: roleId },
      include: { feature: { select: { code: true, name: true, module: true } } },
      orderBy: { feature: { module: "asc" } },
    });
  },

  async setPermissionMatrix(
    db: PrismaClient,
    roleId: string,
    matrix: PermissionMatrixInput
  ) {
    await db.$transaction(async (tx) => {
      await tx.tenantRolePermission.deleteMany({ where: { tenantRoleId: roleId } });

      for (const entry of matrix) {
        await tx.tenantRolePermission.create({
          data: {
            tenantRoleId: roleId,
            featureCode: entry.featureCode,
            canCreate: entry.canCreate,
            canRead: entry.canRead,
            canUpdate: entry.canUpdate,
            canDelete: entry.canDelete,
          },
        });
      }
    });

    invalidatePermissionCache(roleId);

    return db.tenantRolePermission.findMany({
      where: { tenantRoleId: roleId },
      include: { feature: { select: { code: true, name: true, module: true } } },
    });
  },

  async getRoleServices(db: PrismaClient, roleId: string) {
    return db.tenantRoleService.findMany({
      where: { tenantRoleId: roleId },
      include: { service: { select: { id: true, name: true, category: true } } },
    });
  },

  async setRoleServices(
    db: PrismaClient,
    roleId: string,
    organizationId: string,
    serviceIds: string[]
  ) {
    await db.$transaction(async (tx) => {
      await tx.tenantRoleService.deleteMany({ where: { tenantRoleId: roleId } });

      for (const serviceId of serviceIds) {
        await tx.tenantRoleService.create({
          data: {
            tenantRoleId: roleId,
            serviceId,
            organizationId,
          },
        });
      }
    });

    return db.tenantRoleService.findMany({
      where: { tenantRoleId: roleId },
      include: { service: { select: { id: true, name: true, category: true } } },
    });
  },
};
