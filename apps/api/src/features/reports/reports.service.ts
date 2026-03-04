import type { PrismaClient } from "@prisma/client";

export type ReportData = {
  type: string;
  columns: string[];
  rows: Record<string, unknown>[];
  generatedAt: string;
};

export class ReportsService {
  static async generateReport(
    db: PrismaClient,
    opts: { type: string; branchId: string; dateFrom: string; dateTo: string }
  ): Promise<ReportData> {
    const from = new Date(opts.dateFrom);
    const to = new Date(opts.dateTo);
    to.setUTCHours(23, 59, 59, 999);

    switch (opts.type) {
      case "daily_revenue":
        return this.dailyRevenueReport(db, opts.branchId, from, to);
      case "service_popularity":
        return this.servicePopularityReport(db, opts.branchId, from, to);
      case "barber_leaderboard":
      case "staff_leaderboard":
        return this.barberLeaderboardReport(db, opts.branchId, from, to);
      case "customer_visits":
        return this.customerVisitsReport(db, opts.branchId, from, to);
      case "booking_source":
        return this.bookingSourceReport(db, opts.branchId, from, to);
      default:
        throw new Error(`Unknown report type: ${opts.type}`);
    }
  }

  private static async dailyRevenueReport(
    db: PrismaClient, branchId: string, from: Date, to: Date
  ): Promise<ReportData> {
    const snapshots = await db.branchDailySnapshot.findMany({
      where: { branchId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });

    return {
      type: "daily_revenue",
      columns: ["Date", "Revenue", "Service Rev", "Product Rev", "Tips", "Tx Count", "Avg Value"],
      rows: snapshots.map((s) => ({
        Date: s.date.toISOString().slice(0, 10),
        Revenue: s.totalRevenue,
        "Service Rev": s.serviceRevenue,
        "Product Rev": s.productRevenue,
        Tips: s.totalTips,
        "Tx Count": s.transactionCount,
        "Avg Value": s.avgTransValue,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private static async servicePopularityReport(
    db: PrismaClient, branchId: string, from: Date, to: Date
  ): Promise<ReportData> {
    const items = await db.transactionItem.findMany({
      where: {
        transaction: { branchId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
      },
      include: { service: { select: { name: true } } },
    });

    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const item of items) {
      const name = item.service?.name ?? "Unknown";
      const existing = serviceMap.get(name) ?? { name, count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += item.total;
      serviceMap.set(name, existing);
    }

    const sorted = Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((s, r) => s + r.revenue, 0);

    return {
      type: "service_popularity",
      columns: ["Service", "Times Sold", "Revenue", "% of Total"],
      rows: sorted.map((s) => ({
        Service: s.name,
        "Times Sold": s.count,
        Revenue: s.revenue,
        "% of Total": totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private static async barberLeaderboardReport(
    db: PrismaClient, branchId: string, from: Date, to: Date
  ): Promise<ReportData> {
    const earnings = await db.staffEarning.findMany({
      where: {
        date: { gte: from, lte: to },
        staff: {
          user: { branchId },
        },
      },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const staffMap = new Map<string, { name: string; revenue: number; commission: number; tips: number; total: number }>();
    for (const e of earnings) {
      const name = `${e.staff.user.firstName} ${e.staff.user.lastName}`;
      const existing = staffMap.get(e.staffProfileId) ?? { name, revenue: 0, commission: 0, tips: 0, total: 0 };
      existing.revenue += e.commissionBase;
      existing.commission += e.commission;
      existing.tips += e.tips;
      existing.total += e.total;
      staffMap.set(e.staffProfileId, existing);
    }

    const sorted = Array.from(staffMap.values()).sort((a, b) => b.total - a.total);

    return {
      type: "barber_leaderboard",
      columns: ["Rank", "Staff", "Revenue", "Commission", "Tips", "Total"],
      rows: sorted.map((b, i) => ({
        Rank: i + 1,
        Staff: b.name,
        Revenue: b.revenue,
        Commission: b.commission,
        Tips: b.tips,
        Total: b.total,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private static async customerVisitsReport(
    db: PrismaClient, branchId: string, from: Date, to: Date
  ): Promise<ReportData> {
    const transactions = await db.transaction.findMany({
      where: { branchId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
      select: { customerId: true },
    });

    const customerIds = [...new Set(transactions.map((t) => t.customerId).filter((id): id is string => !!id))];
    const users = customerIds.length > 0
      ? await db.user.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const customerMap = new Map<string, { name: string; email: string; visits: number }>();
    for (const tx of transactions) {
      if (!tx.customerId) continue;
      const u = userMap.get(tx.customerId);
      const name = u ? `${u.firstName} ${u.lastName}`.trim() : "Unknown";
      const existing = customerMap.get(tx.customerId) ?? { name, email: u?.email ?? "", visits: 0 };
      existing.visits++;
      customerMap.set(tx.customerId, existing);
    }

    const sorted = Array.from(customerMap.values()).sort((a, b) => b.visits - a.visits);

    return {
      type: "customer_visits",
      columns: ["Customer", "Email", "Visits"],
      rows: sorted.map((c) => ({
        Customer: c.name,
        Email: c.email,
        Visits: c.visits,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private static async bookingSourceReport(
    db: PrismaClient, branchId: string, from: Date, to: Date
  ): Promise<ReportData> {
    const entries = await db.queueEntry.groupBy({
      by: ["source"],
      where: {
        branchId,
        createdAt: { gte: from, lte: to },
        status: { notIn: ["CANCELLED"] },
      },
      _count: true,
    });

    const total = entries.reduce((s, e) => s + e._count, 0);

    return {
      type: "booking_source",
      columns: ["Source", "Count", "% of Total"],
      rows: entries.map((e) => ({
        Source: e.source,
        Count: e._count,
        "% of Total": total > 0 ? Math.round((e._count / total) * 100) : 0,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  static exportCSV(report: ReportData): string {
    const header = report.columns.join(",");
    const rows = report.rows.map((row) =>
      report.columns.map((col) => {
        const val = row[col];
        if (typeof val === "string" && val.includes(",")) return `"${val}"`;
        return String(val ?? "");
      }).join(",")
    );
    return header + "\n" + rows.join("\n");
  }
}
