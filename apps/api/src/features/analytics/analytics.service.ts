import type { PrismaClient } from "@prisma/client";

export class AnalyticsService {
  static async getGlobalDashboard(db: PrismaClient, dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const branches = await db.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        isEmergencyClosed: true,
        averageRating: true,
      },
    });

    const results = await Promise.all(
      branches.map(async (branch) => {
        const snapshot = await db.branchDailySnapshot.findUnique({
          where: { branchId_date: { branchId: branch.id, date: dayStart } },
        });

        const [activeBarbers, queueLength] = await Promise.all([
          db.staffAttendance.count({
            where: {
              clockIn: { gte: dayStart },
              clockOut: null,
              staff: {
                user: { branchId: branch.id },
              },
            },
          }),
          db.queueEntry.count({
            where: {
              branchId: branch.id,
              status: { in: ["WAITING", "CALLED", "IN_SERVICE"] },
            },
          }),
        ]);

        const revenue = snapshot?.totalRevenue ?? 0;
        const transactionCount = snapshot?.transactionCount ?? 0;

        return {
          branchId: branch.id,
          branchName: branch.name,
          isOpen: !branch.isEmergencyClosed,
          revenue,
          transactionCount,
          activeBarbers,
          queueLength,
          avgRating: branch.averageRating,
        };
      })
    );

    const totals = {
      totalRevenue: results.reduce((s, b) => s + b.revenue, 0),
      totalTransactions: results.reduce((s, b) => s + b.transactionCount, 0),
      totalActiveBarbers: results.reduce((s, b) => s + b.activeBarbers, 0),
      totalQueueEntries: results.reduce((s, b) => s + b.queueLength, 0),
    };

    const unresolvedAnomalies = await db.anomalyFlag.findMany({
      where: { isResolved: false },
      include: { branch: { select: { name: true } } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 10,
    });

    const alerts = unresolvedAnomalies.map((a) => ({
      type: a.type,
      branchId: a.branchId,
      branchName: a.branch.name,
      message: formatAnomalyMessage(a),
      severity: a.severity,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      date: dayStart.toISOString().slice(0, 10),
      branches: results,
      totals,
      alerts,
    };
  }

  static async getBranchComparison(
    db: PrismaClient,
    opts: { branchIds?: string[]; dateFrom: string; dateTo: string; metric: string }
  ) {
    let ids = opts.branchIds;
    if (!ids || ids.length === 0) {
      const allBranches = await db.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      ids = allBranches.map((b) => b.id);
    }

    const branches = await db.branch.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(branches.map((b) => [b.id, b.name]));

    const results = await Promise.all(
      ids.map(async (branchId) => {
        const snapshots = await db.branchDailySnapshot.findMany({
          where: {
            branchId,
            date: { gte: new Date(opts.dateFrom), lte: new Date(opts.dateTo) },
          },
          orderBy: { date: "asc" },
        });

        const metricKey = getMetricKey(opts.metric);
        const dataPoints = snapshots.map((s) => ({
          date: s.date.toISOString().slice(0, 10),
          value: Number((s as Record<string, unknown>)[metricKey] ?? 0),
        }));

        const total = dataPoints.reduce((sum, dp) => sum + dp.value, 0);
        const average = dataPoints.length > 0 ? total / dataPoints.length : 0;

        return {
          branchId,
          branchName: nameMap.get(branchId) ?? branchId,
          dataPoints,
          total,
          average,
        };
      })
    );

    return results;
  }

  static async getPeakHeatmap(
    db: PrismaClient,
    opts: { branchId?: string; dateFrom: string; dateTo: string }
  ) {
    const where: Record<string, unknown> = {
      status: "COMPLETED",
      createdAt: { gte: new Date(opts.dateFrom), lte: new Date(opts.dateTo) },
    };
    if (opts.branchId) where.branchId = opts.branchId;

    const transactions = await db.transaction.findMany({
      where: where as any,
      select: { createdAt: true },
    });

    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

    for (const tx of transactions) {
      const wibTime = new Date(tx.createdAt.getTime() + WIB_OFFSET);
      const day = wibTime.getUTCDay();
      const hour = wibTime.getUTCHours();
      heatmap[day][hour]++;
    }

    let peakDay = 0;
    let peakHour = 0;
    let peakVal = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmap[d][h] > peakVal) {
          peakVal = heatmap[d][h];
          peakDay = d;
          peakHour = h;
        }
      }
    }

    return { heatmap, peakDay, peakHour, peakValue: peakVal };
  }

  static async getRetentionCohort(
    db: PrismaClient,
    opts: { branchId?: string; cohortMonth: string }
  ) {
    const [year, month] = opts.cohortMonth.split("-").map(Number);
    const cohortStart = new Date(Date.UTC(year, month - 1, 1));
    const cohortEnd = new Date(Date.UTC(year, month, 1));

    const where: Record<string, unknown> = {
      status: "COMPLETED",
      createdAt: { gte: cohortStart, lt: cohortEnd },
    };
    if (opts.branchId) where.branchId = opts.branchId;

    const cohortTransactions = await db.transaction.findMany({
      where: where as any,
      select: { customerId: true },
      distinct: ["customerId"],
    });

    const cohortCustomerIds = cohortTransactions
      .map((t) => t.customerId)
      .filter((id): id is string => !!id);

    if (cohortCustomerIds.length === 0) {
      return { cohortSize: 0, returnRates: [] };
    }

    const returnRates: { month: number; rate: number }[] = [];
    for (let offset = 1; offset <= 6; offset++) {
      const mStart = new Date(Date.UTC(year, month - 1 + offset, 1));
      const mEnd = new Date(Date.UTC(year, month + offset, 1));

      const returnedWhere: Record<string, unknown> = {
        status: "COMPLETED",
        createdAt: { gte: mStart, lt: mEnd },
        customerId: { in: cohortCustomerIds },
      };
      if (opts.branchId) returnedWhere.branchId = opts.branchId;

      const returned = await db.transaction.findMany({
        where: returnedWhere as any,
        select: { customerId: true },
        distinct: ["customerId"],
      });

      returnRates.push({
        month: offset,
        rate: returned.length / cohortCustomerIds.length,
      });
    }

    return { cohortSize: cohortCustomerIds.length, returnRates };
  }

  static async getRevenueForecast(
    db: PrismaClient,
    opts: { branchId: string; periods: number }
  ) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);

    const snapshots = await db.branchDailySnapshot.findMany({
      where: {
        branchId: opts.branchId,
        date: { gte: twelveMonthsAgo },
      },
      orderBy: { date: "asc" },
    });

    const monthlyMap = new Map<string, number>();
    for (const s of snapshots) {
      const key = s.date.toISOString().slice(0, 7);
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + s.totalRevenue);
    }

    const months = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue], i) => ({ month, revenue, x: i }));

    if (months.length < 2) {
      return { historical: months, forecast: [], slope: 0, intercept: 0 };
    }

    const n = months.length;
    const sumX = months.reduce((s, m) => s + m.x, 0);
    const sumY = months.reduce((s, m) => s + m.revenue, 0);
    const sumXY = months.reduce((s, m) => s + m.x * m.revenue, 0);
    const sumX2 = months.reduce((s, m) => s + m.x * m.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast: { month: string; revenue: number }[] = [];
    const lastDate = new Date(months[months.length - 1].month + "-01");
    for (let i = 1; i <= opts.periods; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      const x = n - 1 + i;
      forecast.push({
        month: futureDate.toISOString().slice(0, 7),
        revenue: Math.max(0, Math.round(slope * x + intercept)),
      });
    }

    return {
      historical: months.map((m) => ({ month: m.month, revenue: m.revenue })),
      forecast,
      slope: Math.round(slope),
      intercept: Math.round(intercept),
    };
  }

  static async computeDailySnapshots(db: PrismaClient, dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    date.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const branches = await db.branch.findMany({
      where: { isActive: true },
      select: { id: true, organizationId: true },
    });

    let count = 0;
    for (const branch of branches) {
      const txWhere = {
        branchId: branch.id,
        status: "COMPLETED" as const,
        createdAt: { gte: date, lt: nextDay },
      };

      const [agg, txCount, customerIds, queueStats] = await Promise.all([
        db.transaction.aggregate({
          where: txWhere,
          _sum: { netAmount: true, taxAmount: true, tipAmount: true },
        }),
        db.transaction.count({ where: txWhere }),
        db.transaction.findMany({
          where: txWhere,
          select: { customerId: true },
          distinct: ["customerId"],
        }),
        db.queueEntry.groupBy({
          by: ["source"],
          where: {
            branchId: branch.id,
            createdAt: { gte: date, lt: nextDay },
            status: { notIn: ["CANCELLED"] },
          },
          _count: true,
        }),
      ]);

      const totalRevenue = (agg._sum.netAmount ?? 0) - (agg._sum.taxAmount ?? 0);
      const totalTips = agg._sum.tipAmount ?? 0;
      const customerCount = customerIds.filter((c) => c.customerId).length;
      const walkInCount = queueStats.find((s) => s.source === "WALK_IN")?._count ?? 0;
      const onlineCount = queueStats.filter((s) => s.source !== "WALK_IN").reduce((sum, s) => sum + s._count, 0);

      await db.branchDailySnapshot.upsert({
        where: { branchId_date: { branchId: branch.id, date } },
        update: {
          totalRevenue,
          serviceRevenue: totalRevenue,
          productRevenue: 0,
          totalTips,
          transactionCount: txCount,
          customerCount,
          walkInCount,
          onlineCount,
          avgTransValue: txCount > 0 ? totalRevenue / txCount : 0,
        },
        create: {
          organizationId: branch.organizationId,
          branchId: branch.id,
          date,
          totalRevenue,
          serviceRevenue: totalRevenue,
          productRevenue: 0,
          totalTips,
          transactionCount: txCount,
          customerCount,
          walkInCount,
          onlineCount,
          avgTransValue: txCount > 0 ? totalRevenue / txCount : 0,
        },
      });
      count++;
    }

    return { branchesProcessed: count, date: date.toISOString().slice(0, 10) };
  }
}

function getMetricKey(metric: string): string {
  switch (metric) {
    case "revenue": return "totalRevenue";
    case "transactions": return "transactionCount";
    case "avgTicket": return "avgTransValue";
    case "customerCount": return "customerCount";
    default: return "totalRevenue";
  }
}

function formatAnomalyMessage(a: { type: string; details: unknown }): string {
  const d = a.details as Record<string, unknown> | null;
  switch (a.type) {
    case "EXCESSIVE_VOIDS": return `${d?.voidCount ?? "Multiple"} void transactions in ${d?.window ?? "1 hour"}`;
    case "HIGH_DISCOUNT": return `Discount of ${d?.percentage ?? ">50"}% applied without Manager role`;
    case "OFF_HOURS_CLOCKIN": return `Clock-in at ${d?.clockInTime ?? "unknown"} outside operating hours (${d?.branchOpen}–${d?.branchClose})`;
    case "UNUSUAL_REFUND": return "Multiple refunds detected in short period";
    case "INVENTORY_DISCREPANCY": return "Stock count mismatch detected";
    default: return a.type.replace(/_/g, " ");
  }
}
