import type { PrismaClient } from "@prisma/client";
import type { ListEarningsQuery } from "./commissions.schema";

/** Accepts both PrismaClient and transaction client from $transaction. */
type DbLike = Pick<PrismaClient, "transaction" | "staffProfile" | "staffEarning" | "branch">;

function getWorkingDaysInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek !== 0) count++; // exclude Sunday
  }
  return count;
}

export const CommissionService = {
  /**
   * Calculate daily commission for a staff for a given date and upsert StaffEarning.
   * Uses FLAT_PERCENTAGE, SLIDING_SCALE, or BASE_PLUS_BONUS per staff's commissionModel.
   */
  async calculateDaily(db: DbLike, staffProfileId: string, date: Date) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    const staff = await db.staffProfile.findUnique({
      where: { id: staffProfileId },
      include: {
        commissionTiers: { orderBy: { minRevenue: "asc" } },
      },
    });
    if (!staff) throw new Error("Staff not found");

    const transactions = await db.transaction.findMany({
      where: {
        staffProfileId,
        status: "COMPLETED",
        createdAt: { gte: dateOnly, lt: nextDay },
      },
      include: { items: true },
    });

    let commissionBase = 0;
    let tips = 0;

    // Group transactions by branch for tip distribution logic
    const branchIds = [...new Set(transactions.map((tx) => tx.branchId).filter(Boolean))] as string[];

    for (const tx of transactions) {
      for (const item of tx.items) {
        if (item.serviceId != null) {
          commissionBase += item.unitPrice * item.quantity - (item.discount ?? 0);
        }
      }
    }

    // Calculate tips based on branch tipDistribution setting
    for (const branchId of branchIds) {
      const branch = await db.branch.findUnique({
        where: { id: branchId },
        select: { tipDistribution: true },
      });
      const branchTx = transactions.filter((tx) => tx.branchId === branchId);

      if (branch?.tipDistribution === "POOLED") {
        // Sum all tips at this branch for the day
        const allBranchTx = await db.transaction.findMany({
          where: {
            branchId,
            status: "COMPLETED",
            createdAt: { gte: dateOnly, lt: nextDay },
          },
          select: { tipAmount: true, staffProfileId: true },
        });
        const totalTipsAtBranch = allBranchTx.reduce((sum, t) => sum + (t.tipAmount ?? 0), 0);
        const staffIdsAtBranch = [...new Set(allBranchTx.map((t) => t.staffProfileId).filter(Boolean))];
        const staffCount = staffIdsAtBranch.length;
        const sharePerStaff = staffCount > 0 ? totalTipsAtBranch / staffCount : 0;
        if (staffIdsAtBranch.includes(staffProfileId)) {
          tips += sharePerStaff;
        }
      } else {
        // PER_STAFF (default): tips go to the staff who served
        tips += branchTx.reduce((sum, t) => sum + (t.tipAmount ?? 0), 0);
      }
    }

    let commission = 0;
    switch (staff.commissionModel) {
      case "FLAT_PERCENTAGE":
        commission = commissionBase * (staff.commissionRate ?? 0);
        break;
      case "SLIDING_SCALE": {
        let remaining = commissionBase;
        for (const tier of staff.commissionTiers) {
          const bracketSize =
            tier.maxRevenue != null ? tier.maxRevenue - tier.minRevenue : remaining;
          const applicable = Math.min(remaining, bracketSize);
          commission += applicable * tier.rate;
          remaining -= applicable;
          if (remaining <= 0) break;
        }
        break;
      }
      case "BASE_PLUS_BONUS": {
        const year = dateOnly.getFullYear();
        const month = dateOnly.getMonth() + 1;
        const workingDays = getWorkingDaysInMonth(year, month);
        const dailyBase = workingDays > 0 ? (staff.baseSalary ?? 0) / workingDays : 0;
        const bonus = commissionBase * (staff.bonusRate ?? 0);
        commission = dailyBase + bonus;
        break;
      }
      default:
        commission = commissionBase * (staff.commissionRate ?? 0);
    }

    const total = commission + tips;

    const earning = await db.staffEarning.upsert({
      where: {
        staffProfileId_date: { staffProfileId, date: dateOnly },
      },
      create: {
        staffProfileId,
        organizationId: staff.organizationId,
        date: dateOnly,
        commissionBase,
        commission,
        tips,
        total,
      },
      update: {
        commissionBase,
        commission,
        tips,
        total,
      },
    });
    return earning;
  },

  /**
   * Triggered when a transaction is marked COMPLETED. Recalculates earning(s) for that day.
   * For POOLED tip distribution, recalculates for all staffs who worked at the branch that day.
   */
  async triggerOnPaid(db: DbLike, transactionId: string) {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      select: { staffProfileId: true, branchId: true, createdAt: true },
    });
    if (!transaction?.branchId) return null;
    const date = new Date(transaction.createdAt);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    const branch = await db.branch.findUnique({
      where: { id: transaction.branchId },
      select: { tipDistribution: true },
    });

    if (branch?.tipDistribution === "POOLED") {
      // Recalculate for all staffs who had completed transactions at this branch that day
      const staffIds = await db.transaction.findMany({
        where: {
          branchId: transaction.branchId,
          status: "COMPLETED",
          createdAt: { gte: dateOnly, lt: nextDay },
        },
        select: { staffProfileId: true },
        distinct: ["staffProfileId"],
      });
      const results = [];
      for (const { staffProfileId } of staffIds) {
        if (staffProfileId) {
          results.push(await this.calculateDaily(db, staffProfileId, date));
        }
      }
      return results;
    }

    if (!transaction.staffProfileId) return null;
    return this.calculateDaily(db, transaction.staffProfileId, date);
  },

  /**
   * Delete existing earning and recompute for the day.
   */
  async recalculateDay(db: DbLike, staffProfileId: string, date: Date) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    await db.staffEarning.deleteMany({
      where: { staffProfileId, date: dateOnly },
    });
    return this.calculateDaily(db, staffProfileId, dateOnly);
  },

  async getEarnings(db: DbLike, query: ListEarningsQuery) {
    const where: { staffProfileId?: string; date?: { gte?: Date; lte?: Date } } = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        const d = new Date(query.dateFrom);
        d.setHours(0, 0, 0, 0);
        where.date.gte = d;
      }
      if (query.dateTo) {
        const d = new Date(query.dateTo);
        d.setHours(23, 59, 59, 999);
        where.date.lte = d;
      }
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      db.staffEarning.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ date: "desc" }, { staffProfileId: "asc" }],
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      db.staffEarning.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },

  async getEarningsForBarber(db: DbLike, staffProfileId: string, query: ListEarningsQuery) {
    return this.getEarnings(db, { ...query, staffProfileId });
  },
};
