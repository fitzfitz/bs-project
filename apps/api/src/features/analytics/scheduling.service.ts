import type { PrismaClient } from "@prisma/client";

const DEFAULT_AVG_SERVICE_MINUTES = 45;

export class SchedulingService {
  static async computeSuggestions(db: PrismaClient, branchId: string, organizationId: string) {
    await db.scheduleSuggestion.deleteMany({ where: { branchId } });

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 8);

    const forecasts = await db.demandForecast.findMany({
      where: { branchId, date: { gt: now, lt: weekEnd } },
      orderBy: { date: "asc" },
    });

    if (forecasts.length === 0) return { suggestionsCreated: 0 };

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const completedEntries = await db.queueEntry.findMany({
      where: {
        branchId,
        status: { in: ["COMPLETED", "PAID"] },
        startedAt: { not: null },
        completedAt: { not: null, gte: thirtyDaysAgo },
      },
      select: { startedAt: true, completedAt: true },
    });

    let avgServiceMinutes = DEFAULT_AVG_SERVICE_MINUTES;
    if (completedEntries.length > 5) {
      const totalMinutes = completedEntries.reduce((sum, e) => {
        const diff = (e.completedAt!.getTime() - e.startedAt!.getTime()) / 60000;
        return sum + Math.min(diff, 240);
      }, 0);
      avgServiceMinutes = totalMinutes / completedEntries.length;
    }

    const suggestions: Array<{
      branchId: string;
      organizationId: string;
      date: Date;
      suggestedStart: string;
      suggestedEnd: string;
      reason: string;
      demandScore: number;
    }> = [];

    for (const forecast of forecasts) {
      const date = forecast.date;

      const scheduledShifts = await db.shiftSchedule.findMany({
        where: {
          date,
          isLeave: false,
          staff: { user: { branchId } },
        },
        select: { startTime: true, endTime: true },
      });

      const scheduledHours = scheduledShifts.reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
      }, 0);

      const requiredHours = (forecast.predictedTransactions * avgServiceMinutes) / 60;

      const demandScore =
        scheduledHours > 0 ? requiredHours / scheduledHours : requiredHours > 0 ? 2.0 : 1.0;

      if (demandScore > 1.2) {
        const pctAbove = Math.round((demandScore - 1) * 100);
        suggestions.push({
          branchId,
          organizationId,
          date,
          suggestedStart: "10:00",
          suggestedEnd: "18:00",
          reason: `Predicted ${pctAbove}% above capacity — add staff`,
          demandScore,
        });
      } else if (demandScore < 0.7 && scheduledHours > 0) {
        const pctBelow = Math.round((1 - demandScore) * 100);
        suggestions.push({
          branchId,
          organizationId,
          date,
          suggestedStart: "10:00",
          suggestedEnd: "18:00",
          reason: `Predicted ${pctBelow}% below capacity — consider reducing staff`,
          demandScore,
        });
      }
    }

    for (const s of suggestions) {
      await db.scheduleSuggestion.create({ data: s });
    }

    return { suggestionsCreated: suggestions.length };
  }

  static async getSuggestions(db: PrismaClient, branchId: string, weekStart?: string) {
    const where: { branchId: string; date?: { gte: Date; lt: Date } } = { branchId };
    if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      where.date = { gte: start, lt: end };
    }

    return db.scheduleSuggestion.findMany({
      where,
      orderBy: { date: "asc" },
    });
  }

  static async updateSuggestion(db: PrismaClient, id: string, status: "ACCEPTED" | "REJECTED") {
    const suggestion = await db.scheduleSuggestion.update({
      where: { id },
      data: { status },
    });

    if (status === "ACCEPTED" && suggestion.staffProfileId) {
      await db.shiftSchedule.create({
        data: {
          organizationId: suggestion.organizationId,
          staffProfileId: suggestion.staffProfileId,
          date: suggestion.date,
          startTime: suggestion.suggestedStart,
          endTime: suggestion.suggestedEnd,
        },
      });
    }

    return suggestion;
  }
}
