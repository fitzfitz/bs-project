import type { Prisma, PrismaClient, ReportFrequency } from "@prisma/client";
import PDFDocument from "pdfkit";

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

  private static readonly MONEY_COLUMNS = new Set([
    "Revenue", "Service Rev", "Product Rev", "Tips", "Avg Value",
    "Total Revenue", "Total Spend", "Avg Spend",
  ]);

  static formatAmount(value: number, currency = "IDR", locale = "id-ID"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private static formatCell(col: string, val: unknown, currency?: string, locale?: string): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "number" && this.MONEY_COLUMNS.has(col)) {
      return this.formatAmount(val, currency, locale);
    }
    return String(val);
  }

  static exportCSV(report: ReportData, currency?: string, locale?: string): string {
    const header = report.columns.join(",");
    const rows = report.rows.map((row) =>
      report.columns.map((col) => {
        const s = this.formatCell(col, row[col], currency, locale);
        if (s.includes(",")) return `"${s}"`;
        return s;
      }).join(",")
    );
    return header + "\n" + rows.join("\n");
  }

  static exportPDF(
    report: ReportData,
    dateRange?: { dateFrom: string; dateTo: string },
    currency?: string,
    locale?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const title = report.type
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      doc.fontSize(18).text(title, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      if (dateRange) {
        doc.text(`Date range: ${dateRange.dateFrom} to ${dateRange.dateTo}`);
      }
      doc.moveDown(1);

      const margin = 50;
      const pageInnerWidth = doc.page.width - 2 * margin;
      const cols = report.columns;
      const colWidth = Math.max(48, pageInnerWidth / Math.max(cols.length, 1));
      const rowStep = 14;
      const bottomReserve = 56;

      const writeHeaderRow = (y: number): number => {
        doc.font("Helvetica-Bold").fontSize(9);
        let x = margin;
        for (const col of cols) {
          doc.text(String(col).slice(0, 24), x, y, { width: colWidth - 2, ellipsis: true });
          x += colWidth;
        }
        return y + rowStep;
      };

      let rowY = doc.y;
      rowY = writeHeaderRow(rowY);
      doc.font("Helvetica").fontSize(8);

      for (const row of report.rows) {
        if (rowY > doc.page.height - bottomReserve) {
          doc.addPage();
          rowY = margin;
          rowY = writeHeaderRow(rowY);
          doc.font("Helvetica").fontSize(8);
        }
        let x = margin;
        for (const col of cols) {
          const s = this.formatCell(col, row[col], currency, locale);
          doc.text(s.slice(0, 48), x, rowY, { width: colWidth - 2, ellipsis: true });
          x += colWidth;
        }
        rowY += rowStep - 2;
      }

      if (rowY > doc.page.height - bottomReserve) {
        doc.addPage();
        rowY = margin;
      }
      doc.fontSize(8).text(`Generated at: ${new Date().toISOString()}`, margin, doc.page.height - bottomReserve);

      doc.end();
    });
  }

  static computeNextRunAt(frequency: ReportFrequency, fromDate: Date = new Date()): Date {
    const y = fromDate.getUTCFullYear();
    const m = fromDate.getUTCMonth();
    const d = fromDate.getUTCDate();

    if (frequency === "DAILY") {
      let candidate = new Date(Date.UTC(y, m, d, 6, 0, 0, 0));
      if (candidate <= fromDate) {
        candidate = new Date(Date.UTC(y, m, d + 1, 6, 0, 0, 0));
      }
      return candidate;
    }

    if (frequency === "WEEKLY") {
      const cur = new Date(fromDate);
      const dow = cur.getUTCDay();
      const monday = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate(), 6, 0, 0, 0));
      const offsetToMonday = dow === 0 ? -6 : 1 - dow;
      monday.setUTCDate(monday.getUTCDate() + offsetToMonday);
      if (monday > fromDate) return monday;
      const next = new Date(monday);
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    }

    const firstNextMonth = new Date(Date.UTC(y, m + 1, 1, 6, 0, 0, 0));
    if (firstNextMonth > fromDate) return firstNextMonth;
    return new Date(Date.UTC(y, m + 2, 1, 6, 0, 0, 0));
  }

  static getScheduledReportDateRange(
    frequency: ReportFrequency,
    runAt: Date = new Date(),
  ): { dateFrom: string; dateTo: string } {
    const y = runAt.getUTCFullYear();
    const m = runAt.getUTCMonth();
    const d = runAt.getUTCDate();

    if (frequency === "DAILY") {
      const prev = new Date(Date.UTC(y, m, d - 1));
      const s = prev.toISOString().slice(0, 10);
      return { dateFrom: s, dateTo: s };
    }

    if (frequency === "WEEKLY") {
      const today = new Date(Date.UTC(y, m, d));
      const dow = today.getUTCDay();
      const mondayThis = new Date(today);
      const offsetToMonday = dow === 0 ? -6 : 1 - dow;
      mondayThis.setUTCDate(today.getUTCDate() + offsetToMonday);
      const prevMonday = new Date(mondayThis);
      prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
      const prevSunday = new Date(prevMonday);
      prevSunday.setUTCDate(prevSunday.getUTCDate() + 6);
      return {
        dateFrom: prevMonday.toISOString().slice(0, 10),
        dateTo: prevSunday.toISOString().slice(0, 10),
      };
    }

    const firstThis = new Date(Date.UTC(y, m, 1));
    const lastPrev = new Date(firstThis);
    lastPrev.setUTCDate(0);
    const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
    return {
      dateFrom: firstPrev.toISOString().slice(0, 10),
      dateTo: lastPrev.toISOString().slice(0, 10),
    };
  }

  static resolveScheduleBranchId(schedule: { branchId: string | null; filters: unknown }): string | null {
    if (schedule.branchId) return schedule.branchId;
    const f = schedule.filters as Record<string, unknown> | null;
    const b = f?.branchId;
    return typeof b === "string" ? b : null;
  }

  static resolveScheduleDates(
    schedule: { frequency: ReportFrequency; filters: unknown },
    runAt: Date,
  ): { dateFrom: string; dateTo: string } {
    const f = schedule.filters as Record<string, unknown> | null;
    const df = f?.dateFrom;
    const dt = f?.dateTo;
    if (typeof df === "string" && typeof dt === "string") {
      return { dateFrom: df, dateTo: dt };
    }
    return this.getScheduledReportDateRange(schedule.frequency, runAt);
  }

  static async listSchedules(db: PrismaClient, organizationId: string) {
    return db.reportSchedule.findMany({
      where: { organizationId },
      orderBy: { nextRunAt: "asc" },
    });
  }

  static async createSchedule(
    db: PrismaClient,
    organizationId: string,
    userId: string,
    data: {
      reportType: string;
      branchId?: string;
      frequency: ReportFrequency;
      recipients: string[];
      filters?: Record<string, unknown>;
    },
  ) {
    const nextRunAt = this.computeNextRunAt(data.frequency);
    return db.reportSchedule.create({
      data: {
        organizationId,
        branchId: data.branchId ?? null,
        reportType: data.reportType,
        frequency: data.frequency,
        recipients: data.recipients,
        filters: (data.filters ?? {}) as Prisma.InputJsonValue,
        createdBy: userId,
        nextRunAt,
      },
    });
  }

  static async updateSchedule(
    db: PrismaClient,
    organizationId: string,
    id: string,
    data: {
      frequency?: ReportFrequency;
      recipients?: string[];
      filters?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    const existing = await db.reportSchedule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new Error("Schedule not found");

    let nextRunAt = existing.nextRunAt;
    if (data.frequency !== undefined && data.frequency !== existing.frequency) {
      nextRunAt = this.computeNextRunAt(data.frequency);
    }

    return db.reportSchedule.update({
      where: { id },
      data: {
        ...(data.frequency !== undefined && { frequency: data.frequency }),
        ...(data.recipients !== undefined && { recipients: data.recipients }),
        ...(data.filters !== undefined && { filters: data.filters as Prisma.InputJsonValue }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        nextRunAt,
      },
    });
  }

  static async deleteSchedule(db: PrismaClient, organizationId: string, id: string) {
    const r = await db.reportSchedule.deleteMany({ where: { id, organizationId } });
    if (!r || r.count === 0) throw new Error("Schedule not found");
  }

  static async listTemplates(db: PrismaClient, organizationId: string) {
    return db.savedReportTemplate.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  static async createTemplate(
    db: PrismaClient,
    organizationId: string,
    userId: string,
    data: { name: string; reportType: string; filters?: Record<string, unknown> },
  ) {
    return db.savedReportTemplate.create({
      data: {
        organizationId,
        name: data.name,
        reportType: data.reportType,
        filters: (data.filters ?? {}) as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
  }

  static async deleteTemplate(db: PrismaClient, organizationId: string, id: string) {
    const r = await db.savedReportTemplate.deleteMany({ where: { id, organizationId } });
    if (!r || r.count === 0) throw new Error("Template not found");
  }
}
