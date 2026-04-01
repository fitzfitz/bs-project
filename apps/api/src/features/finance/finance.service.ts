import type { PrismaClient, Prisma, PayrollStatus } from "@prisma/client";

export class FinanceService {
  static async getPLSummary(
    db: PrismaClient,
    opts: { dateFrom: string; dateTo: string; branchId?: string }
  ) {
    const from = new Date(opts.dateFrom);
    const to = new Date(opts.dateTo);
    to.setUTCHours(23, 59, 59, 999);

    const snapshotWhere: Prisma.BranchDailySnapshotWhereInput = {
      date: { gte: from, lte: to },
    };
    if (opts.branchId) snapshotWhere.branchId = opts.branchId;

    const snapshots = await db.branchDailySnapshot.findMany({
      where: snapshotWhere,
    });

    const serviceRevenue = snapshots.reduce((s, x) => s + x.serviceRevenue, 0);
    const productRevenue = snapshots.reduce((s, x) => s + x.productRevenue, 0);
    const tipsCollected = snapshots.reduce((s, x) => s + x.totalTips, 0);
    const totalRevenue = serviceRevenue + productRevenue;

    const earningWhere: Prisma.StaffEarningWhereInput = {
      date: { gte: from, lte: to },
    };
    if (opts.branchId) {
      earningWhere.staff = { user: { branchId: opts.branchId } };
    }

    const commissionAgg = await db.staffEarning.aggregate({
      where: earningWhere,
      _sum: { commission: true },
    });
    const totalCommissions = commissionAgg._sum.commission ?? 0;

    const payrollWhere: Prisma.PayrollPeriodWhereInput = {
      status: "DISBURSED",
    };
    if (opts.dateFrom || opts.dateTo) {
      payrollWhere.periodStart = { gte: from };
      payrollWhere.periodEnd = { lte: to };
    }
    if (opts.branchId) {
      payrollWhere.staff = { user: { branchId: opts.branchId } };
    }

    const payrollAgg = await db.payrollPeriod.aggregate({
      where: payrollWhere,
      _sum: { totalPayout: true },
    });
    const totalPayroll = payrollAgg._sum.totalPayout ?? 0;

    const txWhere: Prisma.TransactionWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (opts.branchId) txWhere.branchId = opts.branchId;

    const [voidAgg, refundAgg, discountAgg, taxAgg] = await Promise.all([
      db.transaction.aggregate({
        where: { ...txWhere, status: "VOIDED" },
        _sum: { netAmount: true },
      }),
      db.transaction.aggregate({
        where: { ...txWhere, status: "REFUNDED" },
        _sum: { netAmount: true },
      }),
      db.transaction.aggregate({
        where: { ...txWhere, status: "COMPLETED" },
        _sum: { discountAmount: true },
      }),
      db.transaction.aggregate({
        where: { ...txWhere, status: "COMPLETED" },
        _sum: { taxAmount: true },
      }),
    ]);

    const voidsTotal = voidAgg._sum.netAmount ?? 0;
    const refundsTotal = refundAgg._sum.netAmount ?? 0;
    const discountsGiven = discountAgg._sum.discountAmount ?? 0;
    const ppnCollected = taxAgg._sum.taxAmount ?? 0;

    const totalCosts = totalCommissions + totalPayroll;
    const grossProfit = totalRevenue - totalCosts;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      period: { from: opts.dateFrom, to: opts.dateTo },
      revenue: { serviceRevenue, productRevenue, tipsCollected, totalRevenue },
      costs: { totalCommissions, totalPayroll, inventoryCOGS: 0, totalCosts },
      grossProfit,
      margins: { grossMarginPercent: Math.round(grossMarginPercent * 100) / 100 },
      taxes: { ppnCollected },
      discountsGiven,
      voidsTotal,
      refundsTotal,
    };
  }

  static async getVoidDiscountAudit(
    db: PrismaClient,
    opts: { branchId: string; dateFrom: string; dateTo: string }
  ) {
    const from = new Date(opts.dateFrom);
    const to = new Date(opts.dateTo);
    to.setUTCHours(23, 59, 59, 999);

    const [voids, refunds, discounts] = await Promise.all([
      db.auditLog.findMany({
        where: {
          action: "VOID_TRANSACTION",
          branchId: opts.branchId,
          createdAt: { gte: from, lte: to },
        },
        include: { user: { select: { firstName: true, lastName: true, tenantRole: { select: { scope: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      db.auditLog.findMany({
        where: {
          action: "REFUND_TRANSACTION",
          branchId: opts.branchId,
          createdAt: { gte: from, lte: to },
        },
        include: { user: { select: { firstName: true, lastName: true, tenantRole: { select: { scope: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      db.auditLog.findMany({
        where: {
          action: "APPLY_DISCOUNT",
          branchId: opts.branchId,
          createdAt: { gte: from, lte: to },
        },
        include: { user: { select: { firstName: true, lastName: true, tenantRole: { select: { scope: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const voidTotal = voids.reduce((s, v) => {
      const d = v.details as Record<string, unknown> | null;
      return s + Number(d?.amount ?? 0);
    }, 0);

    const refundTotal = refunds.reduce((s, r) => {
      const d = r.details as Record<string, unknown> | null;
      return s + Number(d?.refundedAmount ?? 0);
    }, 0);

    const discountTotal = discounts.reduce((s, d) => {
      const dt = d.details as Record<string, unknown> | null;
      return s + Number(dt?.totalDiscount ?? 0);
    }, 0);

    return { voids, refunds, discounts, voidTotal, refundTotal, discountTotal };
  }

  static async getPayrollOversight(
    db: PrismaClient,
    opts: { dateFrom?: string; dateTo?: string; status?: string }
  ) {
    const where: Prisma.PayrollPeriodWhereInput = {};
    if (opts.status) where.status = opts.status as PayrollStatus;
    if (opts.dateFrom || opts.dateTo) {
      const range: Prisma.DateTimeFilter = {};
      if (opts.dateFrom) range.gte = new Date(opts.dateFrom);
      if (opts.dateTo) range.lte = new Date(opts.dateTo);
      where.periodStart = range;
    }

    return db.payrollPeriod.findMany({
      where,
      include: {
        staff: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { periodStart: "desc" },
      take: 100,
    });
  }

  static async getTaxSummary(
    db: PrismaClient,
    opts: { dateFrom: string; dateTo: string; branchId?: string }
  ) {
    const from = new Date(opts.dateFrom);
    const to = new Date(opts.dateTo);
    to.setUTCHours(23, 59, 59, 999);

    const where: Prisma.TransactionWhereInput = {
      status: "COMPLETED",
      createdAt: { gte: from, lte: to },
    };
    if (opts.branchId) where.branchId = opts.branchId;

    const agg = await db.transaction.aggregate({
      where,
      _sum: { taxAmount: true, netAmount: true },
      _count: true,
    });

    return {
      totalTax: agg._sum.taxAmount ?? 0,
      totalNetRevenue: agg._sum.netAmount ?? 0,
      transactionCount: agg._count,
      period: { from: opts.dateFrom, to: opts.dateTo },
    };
  }
}
