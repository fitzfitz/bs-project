import type { PrismaClient } from "@prisma/client";
import type { DayOfWeek } from "@prisma/client";
import type { CloudflarePusher } from "../../utils/pusher";
import type {
  CreateBranchInput,
  UpdateBranchInput,
  SetOperatingHoursInput,
  CreateSurgeRuleInput,
  UpdateSurgeRuleInput,
  CreateBranchHolidayInput,
  UpdateBranchHolidayInput,
} from "./branches.schema";

export const BranchesService = {
  // --- Branch CRUD ---

  async list(
    db: PrismaClient,
    filters: { city?: string; isActive?: boolean }
  ) {
    const branches = await db.branch.findMany({
      where: {
        ...(filters.city && {
          city: { contains: filters.city, mode: "insensitive" },
        }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      },
      include: {
        operatingHours: true,
        surgeRules: true,
      },
    });
    return branches;
  },

  async getById(db: PrismaClient, id: string) {
    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        operatingHours: true,
        surgeRules: true,
        serviceOverrides: {
          include: { service: true },
        },
      },
    });
    return branch;
  },

  async create(db: PrismaClient, organizationId: string, data: CreateBranchInput) {
    const branch = await db.branch.create({
      data: {
        organizationId,
        name: data.name,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl: data.imageUrl,
        isActive: true,
      },
    });
    return branch;
  },

  async update(db: PrismaClient, id: string, data: UpdateBranchInput) {
    const branch = await db.branch.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        address: data.address ?? undefined,
        city: data.city ?? undefined,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        imageUrl: data.imageUrl ?? undefined,
        isActive: data.isActive ?? undefined,
        tipDistribution: data.tipDistribution ?? undefined,
      },
    });
    return branch;
  },

  async toggleActive(db: PrismaClient, id: string, isActive: boolean) {
    const branch = await db.branch.update({
      where: { id },
      data: { isActive },
    });
    return { id, isActive: branch.isActive };
  },

  // --- Operating Hours ---

  async setOperatingHours(
    db: PrismaClient,
    id: string,
    organizationId: string,
    data: SetOperatingHoursInput
  ) {
    // Transaction: delete all existing hours, then insert new ones
    await db.$transaction([
      db.operatingHour.deleteMany({
        where: { branchId: id },
      }),
      db.operatingHour.createMany({
        data: data.hours.map((h) => ({
          branchId: id,
          organizationId,
          dayOfWeek: h.day as DayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        })),
      }),
    ]);

    return await db.operatingHour.findMany({
      where: { branchId: id },
    });
  },

  // --- Surge Rules ---

  async addSurgeRule(
    db: PrismaClient,
    branchId: string,
    organizationId: string,
    data: CreateSurgeRuleInput
  ) {
    const rules = await db.$transaction(
      data.days.map((day) =>
        db.surgeRule.create({
          data: {
            branchId,
            organizationId,
            name: data.name,
            dayOfWeek: day as DayOfWeek,
            startHour: data.startHour,
            endHour: data.endHour,
            multiplier: data.multiplier,
            isActive: true,
          },
        })
      )
    );
    return rules[0]; // Return the first created rule for the test to grab an ID
  },

  async updateSurgeRule(
    db: PrismaClient,
    ruleId: string,
    data: UpdateSurgeRuleInput
  ) {
    const rule = await db.surgeRule.update({
      where: { id: ruleId },
      data: {
        name: data.name ?? undefined,
        startHour: data.startHour ?? undefined,
        endHour: data.endHour ?? undefined,
        multiplier: data.multiplier ?? undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });
    return rule;
  },

  async deleteSurgeRule(db: PrismaClient, ruleId: string) {
    await db.surgeRule.delete({
      where: { id: ruleId },
    });
  },

  // --- Emergency Closure ---

  async emergencyClose(
    db: PrismaClient,
    branchId: string,
    organizationId: string,
    userId: string,
    pusher?: CloudflarePusher
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id: branchId },
        data: { isEmergencyClosed: true },
      });

      const cancelledQueue = await tx.queueEntry.updateMany({
        where: {
          branchId,
          status: { in: ["WAITING", "CALLED"] },
        },
        data: { status: "CANCELLED" },
      });

      const cancelledBookings = await tx.booking.updateMany({
        where: {
          branchId,
          status: "CONFIRMED",
          scheduledAt: { gte: today, lt: tomorrow },
        },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          action: "EMERGENCY_CLOSURE",
          entityType: "Branch",
          entityId: branchId,
          branchId,
          userId,
          details: {
            queueCancelled: cancelledQueue.count,
            bookingsCancelled: cancelledBookings.count,
          },
        },
      });

      return {
        branch,
        queueCancelled: cancelledQueue.count,
        bookingsCancelled: cancelledBookings.count,
      };
    });

    if (pusher) {
      void pusher.trigger(`branch-${branchId}`, "BRANCH_CLOSED", {
        branchId,
        isEmergencyClosed: true,
      });
    }

    return result;
  },

  async reopen(
    db: PrismaClient,
    branchId: string,
    organizationId: string,
    userId: string,
    pusher?: CloudflarePusher
  ) {
    const branch = await db.branch.update({
      where: { id: branchId },
      data: { isEmergencyClosed: false },
    });

    await db.auditLog.create({
      data: {
        organizationId,
        action: "BRANCH_REOPENED",
        entityType: "Branch",
        entityId: branchId,
        branchId,
        userId,
      },
    });

    if (pusher) {
      void pusher.trigger(`branch-${branchId}`, "BRANCH_REOPENED", {
        branchId,
        isEmergencyClosed: false,
      });
    }

    return branch;
  },

  // --- Branch Holidays ---

  async listHolidays(db: PrismaClient, branchId: string) {
    return db.branchHoliday.findMany({
      where: { branchId },
      orderBy: { date: "asc" },
    });
  },

  async createHoliday(
    db: PrismaClient,
    branchId: string,
    organizationId: string,
    data: CreateBranchHolidayInput
  ) {
    return db.branchHoliday.create({
      data: {
        branchId,
        organizationId,
        date: new Date(data.date),
        name: data.name,
        isClosed: data.isClosed ?? true,
        openTime: data.openTime ?? null,
        closeTime: data.closeTime ?? null,
      },
    });
  },

  async updateHoliday(
    db: PrismaClient,
    holidayId: string,
    data: UpdateBranchHolidayInput
  ) {
    return db.branchHoliday.update({
      where: { id: holidayId },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        name: data.name ?? undefined,
        isClosed: data.isClosed ?? undefined,
        openTime: data.openTime !== undefined ? data.openTime : undefined,
        closeTime: data.closeTime !== undefined ? data.closeTime : undefined,
      },
    });
  },

  async deleteHoliday(db: PrismaClient, holidayId: string) {
    await db.branchHoliday.delete({ where: { id: holidayId } });
  },
};
