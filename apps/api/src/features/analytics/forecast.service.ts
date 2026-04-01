import type { PrismaClient } from "@prisma/client";
import {
  linearRegression,
  linearRegressionLine,
  standardDeviation,
} from "simple-statistics";

function regressionLine(points: [number, number][]): (x: number) => number {
  if (points.length === 0) {
    return () => 0;
  }
  return linearRegressionLine(linearRegression(points));
}

export class ForecastService {
  static async computeForecasts(
    db: PrismaClient,
    branchId: string,
    organizationId: string,
  ) {
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

    const snapshots = await db.branchDailySnapshot.findMany({
      where: { branchId, date: { gte: ninetyDaysAgo } },
      orderBy: { date: "asc" },
    });

    if (snapshots.length < 14) return { forecastDays: 0 };

    const revenues = snapshots.map((s) => s.totalRevenue);
    const txCounts = snapshots.map((s) => s.transactionCount);

    const trendRevenue = movingAverage(revenues, 7);
    const trendTx = movingAverage(txCounts, 7);

    const seasonalRevenue = computeSeasonalIndices(snapshots, revenues, trendRevenue);
    const seasonalTx = computeSeasonalIndices(snapshots, txCounts, trendTx);

    const trendDataRev = trendRevenue
      .map((v, i) => [i, v] as [number, number])
      .filter(([, v]) => v > 0);
    const linRev = regressionLine(trendDataRev);

    const trendDataTx = trendTx
      .map((v, i) => [i, v] as [number, number])
      .filter(([, v]) => v > 0);
    const linTx = regressionLine(trendDataTx);

    const residuals = revenues
      .map((actual, i) => {
        if (trendRevenue[i] <= 0) return 0;
        const dow = new Date(snapshots[i].date).getUTCDay();
        const predicted = trendRevenue[i] * (seasonalRevenue[dow] || 1);
        return actual - predicted;
      })
      .filter((r) => r !== 0);
    const residualStd = residuals.length > 1 ? standardDeviation(residuals) : 0;

    const futureStart = new Date(now);
    futureStart.setUTCDate(futureStart.getUTCDate() + 1);
    const futureEnd = new Date(now);
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 15);

    const holidays = await db.branchHoliday.findMany({
      where: { branchId, date: { gte: futureStart, lte: futureEnd } },
    });
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

    const baseIndex = snapshots.length;
    const forecasts: Array<{
      branchId: string;
      organizationId: string;
      date: Date;
      predictedTransactions: number;
      predictedRevenue: number;
      confidenceLow: number;
      confidenceHigh: number;
      dayOfWeek: number;
      isHoliday: boolean;
    }> = [];

    for (let d = 1; d <= 14; d++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() + d);
      date.setUTCHours(0, 0, 0, 0);
      const dow = date.getUTCDay();
      const dateStr = date.toISOString().slice(0, 10);
      const isHoliday = holidayDates.has(dateStr);

      let predRevenue = Math.max(0, linRev(baseIndex + d) * (seasonalRevenue[dow] || 1));
      let predTx = Math.max(0, linTx(baseIndex + d) * (seasonalTx[dow] || 1));

      if (isHoliday) {
        predRevenue *= 0.3;
        predTx *= 0.3;
      }

      const confLow = Math.max(0, predRevenue - 1.5 * residualStd);
      const confHigh = predRevenue + 1.5 * residualStd;

      forecasts.push({
        branchId,
        organizationId,
        date,
        predictedTransactions: Math.round(predTx * 10) / 10,
        predictedRevenue: Math.round(predRevenue),
        confidenceLow: Math.round(confLow),
        confidenceHigh: Math.round(confHigh),
        dayOfWeek: dow,
        isHoliday,
      });
    }

    for (const f of forecasts) {
      await db.demandForecast.upsert({
        where: { branchId_date: { branchId: f.branchId, date: f.date } },
        create: f,
        update: {
          predictedTransactions: f.predictedTransactions,
          predictedRevenue: f.predictedRevenue,
          confidenceLow: f.confidenceLow,
          confidenceHigh: f.confidenceHigh,
          dayOfWeek: f.dayOfWeek,
          isHoliday: f.isHoliday,
        },
      });
    }

    return { forecastDays: forecasts.length };
  }

  static async computeAllBranches(db: PrismaClient) {
    const branches = await db.branch.findMany({
      where: { isActive: true },
      select: { id: true, organizationId: true },
    });
    let total = 0;
    for (const b of branches) {
      const result = await this.computeForecasts(db, b.id, b.organizationId);
      total += result.forecastDays;
    }
    return { branchesProcessed: branches.length, totalForecasts: total };
  }

  static async getForecasts(
    db: PrismaClient,
    branchId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const where: Record<string, unknown> = { branchId };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, Date>).lte = new Date(dateTo);
    }

    const forecasts = await db.demandForecast.findMany({
      where,
      orderBy: { date: "asc" },
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const [recentForecasts, recentSnapshots] = await Promise.all([
      db.demandForecast.findMany({
        where: { branchId, date: { gte: sevenDaysAgo, lt: now } },
        orderBy: { date: "asc" },
      }),
      db.branchDailySnapshot.findMany({
        where: { branchId, date: { gte: sevenDaysAgo, lt: now } },
        orderBy: { date: "asc" },
      }),
    ]);

    let mape = 0;
    if (recentForecasts.length > 0 && recentSnapshots.length > 0) {
      const snapshotMap = new Map(
        recentSnapshots.map((s) => [s.date.toISOString().slice(0, 10), s.totalRevenue]),
      );
      let totalApe = 0;
      let count = 0;
      for (const f of recentForecasts) {
        const actual = snapshotMap.get(f.date.toISOString().slice(0, 10));
        if (actual && actual > 0) {
          totalApe += Math.abs(f.predictedRevenue - actual) / actual;
          count++;
        }
      }
      mape = count > 0 ? Math.round((totalApe / count) * 1000) / 10 : 0;
    }

    return {
      forecasts: forecasts.map((f) => ({
        date: f.date.toISOString().slice(0, 10),
        predictedTransactions: f.predictedTransactions,
        predictedRevenue: f.predictedRevenue,
        confidenceLow: f.confidenceLow,
        confidenceHigh: f.confidenceHigh,
        dayOfWeek: f.dayOfWeek,
        isHoliday: f.isHoliday,
      })),
      accuracy: { mape },
    };
  }
}

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(data.length, i + Math.ceil(window / 2));
    const slice = data.slice(start, end);
    result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return result;
}

function computeSeasonalIndices(
  snapshots: { date: Date }[],
  actuals: number[],
  trend: number[],
): Record<number, number> {
  const dowSums: Record<number, number[]> = {};
  for (let i = 0; i < snapshots.length; i++) {
    if (trend[i] <= 0) continue;
    const dow = new Date(snapshots[i].date).getUTCDay();
    if (!dowSums[dow]) dowSums[dow] = [];
    dowSums[dow].push(actuals[i] / trend[i]);
  }
  const indices: Record<number, number> = {};
  for (const [dow, ratios] of Object.entries(dowSums)) {
    indices[Number(dow)] = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  }
  return indices;
}
