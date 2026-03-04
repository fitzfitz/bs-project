import type { PrismaClient, Prisma } from "@prisma/client";
import type { ServiceType, StaffTier } from "@prisma/client";
import type { CreateServiceInput, UpdateServiceInput } from "./services.schema";

/**
 * Service Catalog business logic layer.
 */
export const ServicesService = {
  async list(
    db: PrismaClient,
    filters: {
      category?: string;
      type?: string;
      isActive?: boolean;
      page: number;
      limit: number;
    }
  ) {
    const where: Prisma.ServiceWhereInput = {
      ...(filters.category && { category: filters.category }),
      ...(filters.type && { type: filters.type as ServiceType }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    const total = await db.service.count({ where });
    const data = await db.service.findMany({
      where,
      include: {
        tierSurcharges: true,
        comboChildren: { include: { childService: true } },
        branchOverrides: true,
      },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      orderBy: { sortOrder: "asc" },
    });

    return {
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(db: PrismaClient, id: string) {
    const service = await db.service.findUnique({
      where: { id },
      include: {
        tierSurcharges: true,
        comboChildren: { include: { childService: true } },
        branchOverrides: true,
      },
    });
    return service;
  },

  async create(db: PrismaClient, organizationId: string, data: CreateServiceInput) {
    const service = await db.service.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        type: data.type as ServiceType,
        basePrice: data.basePrice,
        durationMinutes: data.durationMinutes,
        bufferMinutes: data.bufferMinutes,
        isCommissionable: data.isCommissionable,
        loyaltyEligible: data.loyaltyEligible,
        isActive: true,
        sortOrder: data.sortOrder,
      },
    });
    return service;
  },

  async update(db: PrismaClient, id: string, data: UpdateServiceInput) {
    const service = await db.service.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        category: data.category ?? undefined,
        type: data.type ? (data.type as ServiceType) : undefined,
        basePrice: data.basePrice ?? undefined,
        durationMinutes: data.durationMinutes ?? undefined,
        bufferMinutes: data.bufferMinutes ?? undefined,
        isCommissionable: data.isCommissionable ?? undefined,
        loyaltyEligible: data.loyaltyEligible ?? undefined,
        sortOrder: data.sortOrder ?? undefined,
      },
    });
    return service;
  },

  async toggleActive(db: PrismaClient, id: string, isActive: boolean) {
    const service = await db.service.update({
      where: { id },
      data: { isActive },
    });
    return { id, isActive: service.isActive };
  },

  async delete(db: PrismaClient, id: string) {
    await db.service.update({
      where: { id },
      data: { isActive: false },
    });
  },

  // --- Tier Surcharges ---

  async addTierSurcharge(
    db: PrismaClient,
    serviceId: string,
    organizationId: string,
    tier: string,
    surcharge: number
  ) {
    const existing = await db.tierSurcharge.findFirst({
      where: { serviceId, tier: tier as StaffTier },
    });
    if (existing) {
      return await db.tierSurcharge.update({
        where: { id: existing.id },
        data: { surcharge },
      });
    } else {
      return await db.tierSurcharge.create({
        data: { serviceId, organizationId, tier: tier as StaffTier, surcharge },
      });
    }
  },

  async removeTierSurcharge(db: PrismaClient, serviceId: string, tier: string) {
    const existing = await db.tierSurcharge.findFirst({
      where: { serviceId, tier: tier as StaffTier },
    });
    if (existing) {
      await db.tierSurcharge.delete({ where: { id: existing.id } });
    }
  },

  // --- Combo Children ---

  async addComboChild(
    db: PrismaClient,
    comboId: string,
    organizationId: string,
    childServiceId: string
  ) {
    const existing = await db.comboService.findFirst({
      where: { comboId, childServiceId },
    });
    if (!existing) {
      return await db.comboService.create({
        data: { comboId, organizationId, childServiceId },
      });
    }
    return existing;
  },

  async removeComboChild(db: PrismaClient, comboId: string, childServiceId: string) {
    const existing = await db.comboService.findFirst({
      where: { comboId, childServiceId },
    });
    if (existing) {
      await db.comboService.delete({ where: { id: existing.id } });
    }
  },

  // --- Branch Overrides ---

  async setBranchOverride(
    db: PrismaClient,
    serviceId: string,
    branchId: string,
    organizationId: string,
    overridePrice: number | null,
    isActive: boolean
  ) {
    const existing = await db.branchServiceOverride.findFirst({
      where: { serviceId, branchId },
    });
    if (existing) {
      return await db.branchServiceOverride.update({
        where: { id: existing.id },
        data: { overridePrice, isActive },
      });
    } else {
      return await db.branchServiceOverride.create({
        data: { serviceId, branchId, organizationId, overridePrice, isActive },
      });
    }
  },
};
