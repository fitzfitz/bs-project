import type { PrismaClient, IndustryType } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { CreateOrgInput, UpdateOrgInput } from "./platform.schema";

export const PlatformService = {
  async loginAdmin(db: PrismaClient, email: string, password: string) {
    const admin = await db.platformAdmin.findUnique({ where: { email } });
    if (!admin) return null;
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) return null;
    return admin;
  },

  async listOrganizations(db: PrismaClient, filters?: { isActive?: boolean; industry?: string }) {
    return db.organization.findMany({
      where: {
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(filters?.industry ? { industry: filters.industry as IndustryType } : {}),
      },
      include: {
        _count: { select: { branches: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getOrganizationById(db: PrismaClient, id: string) {
    return db.organization.findUnique({
      where: { id },
      include: {
        branches: { select: { id: true, name: true, city: true, isActive: true } },
        tenantRoles: { select: { id: true, name: true, scope: true, isServiceProvider: true } },
        _count: { select: { branches: true, users: true } },
      },
    });
  },

  async createOrganization(db: PrismaClient, data: CreateOrgInput) {
    const existingSlug = await db.organization.findUnique({ where: { slug: data.slug } });
    if (existingSlug) throw new Error("Organization slug already in use");

    const template = await db.industryTemplate.findFirst({
      where: { industryType: data.industry as IndustryType },
    });

    return db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          industryType: data.industry as IndustryType,
        },
      });

      const templateJson = template?.templateData as Record<string, unknown> | null;
      const defaultRoles = (templateJson?.defaultRoles as Array<{ name: string; scope: string; isServiceProvider: boolean }>) ?? null;
      const rolesToCreate = defaultRoles ?? [
        { name: "Owner", scope: "HQ", isServiceProvider: false },
        { name: "Manager", scope: "BRANCH", isServiceProvider: false },
        { name: "Staff", scope: "BRANCH", isServiceProvider: true },
        { name: "Customer", scope: "CUSTOMER", isServiceProvider: false },
      ];

      const createdRoles = [];
      for (const role of rolesToCreate) {
        const created = await tx.tenantRole.create({
          data: {
            organizationId: org.id,
            name: role.name,
            scope: role.scope as "HQ" | "BRANCH" | "CUSTOMER",
            isServiceProvider: role.isServiceProvider,
          },
        });
        createdRoles.push(created);
      }

      const ownerRole = createdRoles.find((r) => r.scope === "HQ") ?? createdRoles[0];

      const features = await tx.feature.findMany();
      const permData = createdRoles.flatMap((role) =>
        features.map((feature) => {
          const isHQ = role.scope === "HQ";
          const isStaff = role.scope === "BRANCH";
          return {
            tenantRoleId: role.id,
            featureCode: feature.code,
            canCreate: isHQ,
            canRead: isHQ || isStaff,
            canUpdate: isHQ,
            canDelete: isHQ,
          };
        }),
      );
      await tx.tenantRolePermission.createMany({ data: permData });

      const passwordHash = await bcrypt.hash(data.ownerPassword, 10);
      const owner = await tx.user.create({
        data: {
          email: data.ownerEmail,
          passwordHash,
          firstName: data.ownerFirstName,
          lastName: data.ownerLastName,
          organizationId: org.id,
          tenantRoleId: ownerRole.id,
          isCustomer: false,
        },
      });

      await tx.notificationPreference.create({
        data: {
          organizationId: org.id,
          userId: owner.id,
          emailOptOut: false,
        },
      });

      return { ...org, roles: createdRoles };
    }, { timeout: 30000 });
  },

  async updateOrganization(db: PrismaClient, id: string, data: UpdateOrgInput) {
    return db.organization.update({ where: { id }, data });
  },

  async listFeatures(db: PrismaClient) {
    return db.feature.findMany({ orderBy: { module: "asc" } });
  },

  async listIndustryTemplates(db: PrismaClient) {
    return db.industryTemplate.findMany({ orderBy: { industryType: "asc" } });
  },

  async listPlatformConfig(db: PrismaClient) {
    return db.platformConfig.findMany({ orderBy: { key: "asc" } });
  },

  async setPlatformConfig(db: PrismaClient, key: string, value: string) {
    return db.platformConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  },
};
