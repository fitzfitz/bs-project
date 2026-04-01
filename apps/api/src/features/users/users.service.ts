import type { PrismaClient, Prisma } from "@prisma/client";

export class UsersService {
  static async listUsers(
    db: PrismaClient,
    opts: {
      role?: string;
      branchId?: string;
      search?: string;
      isActive?: string;
      page: number;
      limit: number;
      callerRole: string;
      callerBranchId?: string;
      organizationId?: string;
    }
  ) {
    const where: Prisma.UserWhereInput = {};

    if (opts.organizationId) {
      where.organizationId = opts.organizationId;
    }
    if (opts.role) {
      where.tenantRole = { name: opts.role };
    }
    if (opts.isActive !== undefined) where.isActive = opts.isActive === "true";

    if (opts.search) {
      where.OR = [
        { firstName: { contains: opts.search, mode: "insensitive" } },
        { lastName: { contains: opts.search, mode: "insensitive" } },
        { email: { contains: opts.search, mode: "insensitive" } },
      ];
    }

    if (opts.branchId) {
      where.branchId = opts.branchId;
    } else if (opts.callerRole === "MANAGER" && opts.callerBranchId) {
      where.branchId = opts.callerBranchId;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          tenantRoleId: true,
          tenantRole: { select: { name: true, scope: true } },
          isActive: true,
          createdAt: true,
          branchId: true,
          branch: { select: { id: true, name: true } },
          staffProfile: { select: { id: true, tier: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      db.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getUserById(db: PrismaClient, userId: string) {
    return db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        tenantRole: { select: { id: true, name: true, scope: true } },
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
        staffProfile: { select: { id: true, tier: true, bio: true } },
        customerMembership: { select: { id: true, pointsBalance: true, tier: true } },
      },
    });
  }

  static async updateRole(
    db: PrismaClient,
    userId: string,
    roleInput: string,
    adminId: string
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantRoleId: true,
        tenantRole: { select: { name: true, scope: true } },
        isActive: true,
        organizationId: true,
      },
    });
    if (!user) throw new Error("User not found");

    let newTenantRoleId = roleInput;
    
    // If roleInput is short, assume it's a name (e.g. "CASHIER") and not a CUID/UUID
    if (!roleInput.includes("-") && roleInput.length < 20) {
      const roleRecord = await db.tenantRole.findFirst({
        where: {
          organizationId: user.organizationId,
          name: { equals: roleInput, mode: "insensitive" },
        },
      });
      if (!roleRecord) throw new Error(`Role '${roleInput}' not found in organization`);
      newTenantRoleId = roleRecord.id;
    }

    const oldTenantRoleId = user.tenantRoleId;
    if (oldTenantRoleId === newTenantRoleId) return user;

    if (user.tenantRole?.scope === "HQ") {
      const hqUserCount = await db.user.count({
        where: {
          tenantRole: { scope: "HQ" },
          isActive: true,
        },
      });
      if (hqUserCount <= 1) {
        throw new Error("Cannot demote the last Super Admin");
      }
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { tenantRoleId: newTenantRoleId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantRoleId: true,
        tenantRole: { select: { name: true, scope: true } },
        isActive: true,
      },
    });

    const adminUser = await db.user.findUnique({
      where: { id: adminId },
      select: { organizationId: true },
    });
    if (!adminUser) throw new Error("Admin not found");

    await db.auditLog.create({
      data: {
        organizationId: adminUser.organizationId,
        action: "ASSIGN_ROLE",
        entityType: "User",
        entityId: userId,
        details: { oldTenantRoleId, newTenantRoleId },
        userId: adminId,
      },
    });

    return updated;
  }

  static async assignBranch(
    db: PrismaClient,
    userId: string,
    branchId: string,
    adminId: string
  ) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const updated = await db.user.update({
      where: { id: userId },
      data: { branchId },
      select: {
        id: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        organizationId: user.organizationId,
        action: "BRANCH_ASSIGNMENT",
        entityType: "User",
        entityId: userId,
        details: { userId, branchId, branchName: updated.branch?.name },
        userId: adminId,
      },
    });

    return updated;
  }

  static async removeBranchAssignment(
    db: PrismaClient,
    userId: string,
    branchId: string,
    adminId: string
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { branch: { select: { id: true, name: true } } },
    });
    if (!user || user.branchId !== branchId) throw new Error("Assignment not found");

    await db.user.update({
      where: { id: userId },
      data: { branchId: null },
    });

    await db.auditLog.create({
      data: {
        organizationId: user.organizationId,
        action: "BRANCH_ASSIGNMENT",
        entityType: "User",
        entityId: userId,
        details: {
          action: "removed",
          userId,
          branchId,
          branchName: user.branch?.name,
        },
        userId: adminId,
      },
    });

    return { removed: true };
  }

  static async deactivateUser(
    db: PrismaClient,
    userId: string,
    adminId: string
  ) {
    if (userId === adminId) {
      throw new Error("Cannot deactivate your own account");
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { tenantRole: { select: { scope: true } } },
    });
    if (!user) throw new Error("User not found");

    if (user.tenantRole?.scope === "HQ") {
      const hqUserCount = await db.user.count({
        where: {
          tenantRole: { scope: "HQ" },
          isActive: true,
        },
      });
      if (hqUserCount <= 1) {
        throw new Error("Cannot deactivate the last Super Admin");
      }
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantRoleId: true,
        tenantRole: { select: { name: true, scope: true } },
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        organizationId: user.organizationId,
        action: "DEACTIVATE_USER",
        entityType: "User",
        entityId: userId,
        details: { email: user.email, tenantRoleId: user.tenantRoleId },
        userId: adminId,
      },
    });

    return updated;
  }

  static async reactivateUser(
    db: PrismaClient,
    userId: string,
    adminId: string
  ) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const updated = await db.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantRoleId: true,
        tenantRole: { select: { name: true, scope: true } },
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        organizationId: user.organizationId,
        action: "ASSIGN_ROLE",
        entityType: "User",
        entityId: userId,
        details: { action: "reactivated", email: user.email },
        userId: adminId,
      },
    });

    return updated;
  }
}
