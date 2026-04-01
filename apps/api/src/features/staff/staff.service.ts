import type { PrismaClient, Prisma } from "@prisma/client";
import type { StaffTier, CommissionModel, StaffStatus } from "@prisma/client";
import type {
  CreateStaffProfileInput,
  UpdateStaffProfileInput,
} from "./staff.schema";
import { ConfigService } from "../config/config.service";

const TIER_CONFIG_MAP: Record<string, string> = {
  MASTER: "COMMISSION_RATE_MASTER",
  SENIOR: "COMMISSION_RATE_SENIOR",
  JUNIOR: "COMMISSION_RATE_JUNIOR",
};

async function getCommissionRateFromConfig(
  db: PrismaClient,
  tier: string,
): Promise<number> {
  const key = TIER_CONFIG_MAP[tier] ?? "COMMISSION_RATE_JUNIOR";
  const pct = await ConfigService.getNumericConfig(db, key, 30);
  return pct / 100;
}

export const StaffService = {
  async list(
    db: PrismaClient,
    filters: {
      branchId?: string;
      tier?: string;
      isActive?: boolean;
      page: number;
      limit: number;
    }
  ) {
    const where: Prisma.StaffProfileWhereInput = {
      ...(filters.tier && { tier: filters.tier as StaffTier }),
      ...(filters.isActive !== undefined && {
        user: { isActive: filters.isActive },
      }),
      ...(filters.branchId && {
        user: { branchId: filters.branchId },
      }),
    };

    const total = await db.staffProfile.count({ where });
    const data = await db.staffProfile.findMany({
      where,
      include: { user: true },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
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
    const profile = await db.staffProfile.findUnique({
      where: { userId: id },
      include: {
        user: {
          include: { branch: true },
        },
      },
    });
    return profile;
  },

  async create(db: PrismaClient, organizationId: string, data: CreateStaffProfileInput) {
    const tier = (data.tier ?? "JUNIOR") as StaffTier;
    const rate =
      data.commissionRate !== undefined
        ? data.commissionRate
        : await getCommissionRateFromConfig(db, tier);

    const profile = await db.staffProfile.create({
      data: {
        userId: data.userId,
        organizationId,
        bio: data.bio ?? null,
        tier,
        specialties: data.specialties ?? [],
        commissionModel: (data.commissionModel ?? "FLAT_PERCENTAGE") as CommissionModel,
        commissionRate: rate,
        baseSalary: data.baseSalary,
        status: "OFF_DUTY",
      },
      include: { user: true },
    });
    return profile;
  },

  async update(db: PrismaClient, id: string, data: UpdateStaffProfileInput) {
    const profile = await db.staffProfile.update({
      where: { userId: id },
      data: {
        bio: data.bio ?? undefined,
        tier: data.tier ? (data.tier as StaffTier) : undefined,
        specialties: data.specialties ?? undefined,
        commissionModel: data.commissionModel
          ? (data.commissionModel as CommissionModel)
          : undefined,
        commissionRate: data.commissionRate ?? undefined,
        baseSalary: data.baseSalary !== undefined ? data.baseSalary : undefined,
        bonusRate: data.bonusRate !== undefined ? data.bonusRate : undefined,
      },
      include: { user: true },
    });
    return profile;
  },

  async toggleActive(db: PrismaClient, id: string, isActive: boolean) {
    const user = await db.user.update({
      where: { id },
      data: { isActive },
    });
    return { userId: id, isActive: user.isActive };
  },

  async assignToBranch(db: PrismaClient, staffProfileId: string, branchId: string) {
    const profile = await db.staffProfile.findUniqueOrThrow({
      where: { id: staffProfileId },
    });
    const user = await db.user.update({
      where: { id: profile.userId },
      data: { branchId },
      include: { branch: true },
    });
    return user;
  },

  async removeFromBranch(db: PrismaClient, staffProfileId: string) {
    const profile = await db.staffProfile.findUniqueOrThrow({
      where: { id: staffProfileId },
    });
    const user = await db.user.update({
      where: { id: profile.userId },
      data: { branchId: null },
    });
    return user;
  },

  async updateStatus(db: PrismaClient, userId: string, status: string) {
    const profile = await db.staffProfile.update({
      where: { userId },
      data: { status: status as StaffStatus },
    });
    return profile;
  },

  async updateAvatar(db: PrismaClient, userId: string, avatar: string | null) {
    const user = await db.user.update({
      where: { id: userId },
      data: { avatar },
      select: { id: true, avatar: true },
    });
    return user;
  },

  async resetCommission(db: PrismaClient, userId: string) {
    const profile = await db.staffProfile.findUnique({ where: { userId } });
    if (!profile) return null;

    const rate = await getCommissionRateFromConfig(db, profile.tier);
    const updated = await db.staffProfile.update({
      where: { userId },
      data: { commissionRate: rate },
      include: { user: true },
    });
    return updated;
  },
};
