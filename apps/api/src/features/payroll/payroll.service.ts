import { PrismaClient } from "@prisma/client";
import type { PayrollStatus } from "@prisma/client";
import type { GeneratePeriodInput, ListPayrollQuery } from "./payroll.schema";

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["APPROVED", "DISPUTED"],
  DISPUTED: ["DRAFT"],
  APPROVED: ["DISBURSED"],
  DISBURSED: [],
};

export const PayrollService = {
  async generatePeriod(db: PrismaClient, data: GeneratePeriodInput) {
    const start = new Date(data.periodStart);
    const end = new Date(data.periodEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const earnings = await db.staffEarning.findMany({
      where: {
        staffProfileId: data.staffProfileId,
        date: { gte: start, lte: end },
      },
    });
    const totalCommission = earnings.reduce((s, e) => s + e.commission, 0);
    const totalTips = earnings.reduce((s, e) => s + e.tips, 0);
    const totalPayout = totalCommission + totalTips;

    const organizationId =
      earnings[0]?.organizationId ??
      (await db.staffProfile.findUnique({ where: { id: data.staffProfileId }, select: { organizationId: true } }))
        ?.organizationId;
    if (!organizationId) throw new Error("Staff profile not found");

    return db.payrollPeriod.create({
      data: {
        staffProfileId: data.staffProfileId,
        organizationId,
        periodStart: start,
        periodEnd: end,
        totalCommission,
        totalTips,
        totalPayout,
        status: "DRAFT",
      },
    });
  },

  async submitForApproval(db: PrismaClient, id: string) {
    return this.transition(db, id, "PENDING_APPROVAL", {});
  },

  async approve(
    db: PrismaClient,
    id: string,
    userId: string,
    organizationId: string,
    note?: string
  ) {
    await this.transition(db, id, "APPROVED", { note });
    const period = await db.payrollPeriod.update({
      where: { id },
      data: { approvedBy: userId, approvedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "APPROVE_PAYROLL",
        entityType: "PayrollPeriod",
        entityId: id,
        details: { note: note ?? null },
      },
    });
    return period;
  },

  async dispute(
    db: PrismaClient,
    id: string,
    userId: string,
    organizationId: string,
    note: string
  ) {
    const period = await this.transition(db, id, "DISPUTED", { note });
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "DISPUTE_PAYROLL",
        entityType: "PayrollPeriod",
        entityId: id,
        details: { note },
      },
    });
    return period;
  },

  async resolveDispute(db: PrismaClient, id: string, note?: string) {
    return this.transition(db, id, "DRAFT", { note });
  },

  async markDisbursed(db: PrismaClient, id: string, note?: string) {
    return this.transition(db, id, "DISBURSED", { note });
  },

  async assertBarberOwnsPayroll(db: PrismaClient, staffProfileId: string, userId: string) {
    const staffProfile = await db.staffProfile.findFirst({
      where: { id: staffProfileId, userId },
    });
    if (!staffProfile) throw new Error("Payroll does not belong to this staff");
  },

  async transition(
    db: PrismaClient,
    id: string,
    newStatus: string,
    _payload: { note?: string }
  ) {
    const period = await db.payrollPeriod.findUnique({ where: { id } });
    if (!period) throw new Error("Payroll period not found");
    const allowed = VALID_TRANSITIONS[period.status];
    if (!allowed?.includes(newStatus)) {
      throw new Error(
        `Invalid transition: ${period.status} -> ${newStatus}`
      );
    }
    return db.payrollPeriod.update({
      where: { id },
      data: { status: newStatus as PayrollStatus },
    });
  },

  async getById(db: PrismaClient, id: string) {
    const period = await db.payrollPeriod.findUnique({
      where: { id },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    if (!period) throw new Error("Payroll period not found");
    return period;
  },

  async list(db: PrismaClient, query: ListPayrollQuery) {
    const where: { staffProfileId?: string; status?: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "DISPUTED" | "DISBURSED" } = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.status) where.status = query.status as "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "DISPUTED" | "DISBURSED";

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      db.payrollPeriod.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { periodStart: "desc" },
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      db.payrollPeriod.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },
};
