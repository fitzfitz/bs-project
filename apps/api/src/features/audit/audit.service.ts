import { type PrismaClient, type Prisma, type DayOfWeek, type AuditAction, type AnomalyType, type AnomSeverity } from "@prisma/client";

export class AuditService {
  static async listLogs(
    db: PrismaClient,
    opts: {
      branchId?: string;
      userId?: string;
      action?: string;
      entityType?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      limit: number;
      callerScope: string;
      callerBranchId?: string;
    }
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (opts.action) where.action = opts.action as AuditAction;
    if (opts.entityType) where.entityType = opts.entityType;
    if (opts.userId) where.userId = opts.userId;

    if (opts.branchId) {
      where.branchId = opts.branchId;
    } else if (opts.callerScope === "BRANCH" && opts.callerBranchId) {
      where.branchId = opts.callerBranchId;
    }

    if (opts.dateFrom || opts.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (opts.dateFrom) createdAt.gte = new Date(opts.dateFrom);
      if (opts.dateTo) createdAt.lte = new Date(opts.dateTo);
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, tenantRole: { select: { name: true, scope: true } } } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async listAnomalies(
    db: PrismaClient,
    opts: {
      branchId?: string;
      type?: string;
      severity?: string;
      isResolved?: string;
      page: number;
      limit: number;
      callerScope: string;
      callerBranchId?: string;
    }
  ) {
    const where: Prisma.AnomalyFlagWhereInput = {};

    if (opts.type) where.type = opts.type as AnomalyType;
    if (opts.severity) where.severity = opts.severity as AnomSeverity;
    if (opts.isResolved !== undefined) where.isResolved = opts.isResolved === "true";

    if (opts.branchId) {
      where.branchId = opts.branchId;
    } else if (opts.callerScope === "BRANCH" && opts.callerBranchId) {
      where.branchId = opts.callerBranchId;
    }

    const [anomalies, total] = await Promise.all([
      db.anomalyFlag.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      db.anomalyFlag.count({ where }),
    ]);

    return {
      anomalies,
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async resolveAnomaly(
    db: PrismaClient,
    anomalyId: string,
    resolvedBy: string,
    notes?: string
  ) {
    const anomaly = await db.anomalyFlag.findUnique({ where: { id: anomalyId } });
    if (!anomaly) throw new Error("Anomaly not found");
    if (anomaly.isResolved) throw new Error("Anomaly already resolved");

    return db.anomalyFlag.update({
      where: { id: anomalyId },
      data: {
        isResolved: true,
        resolvedBy,
        resolvedAt: new Date(),
        details: {
          ...(anomaly.details as Record<string, unknown>),
          resolutionNotes: notes,
        },
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  static async getAnomalyStats(
    db: PrismaClient,
    branchId?: string
  ) {
    const where: Prisma.AnomalyFlagWhereInput = branchId ? { branchId } : {};
    const unresolvedWhere: Prisma.AnomalyFlagWhereInput = { ...where, isResolved: false };

    const [total, unresolved, bySeverity, byType] = await Promise.all([
      db.anomalyFlag.count({ where }),
      db.anomalyFlag.count({ where: unresolvedWhere }),
      db.anomalyFlag.groupBy({
        by: ["severity"],
        where: unresolvedWhere,
        _count: true,
      }),
      db.anomalyFlag.groupBy({
        by: ["type"],
        where: unresolvedWhere,
        _count: true,
      }),
    ]);

    return {
      total,
      unresolved,
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
    };
  }

  /**
   * Anomaly detection logic — called periodically by scheduler.
   */
  static async detectAnomalies(db: PrismaClient): Promise<number> {
    let created = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Excessive voids: >3 voids in 1 hour by same user
    const recentVoids = await db.auditLog.groupBy({
      by: ["userId", "branchId", "organizationId"],
      where: { action: "VOID_TRANSACTION", createdAt: { gte: oneHourAgo } },
      _count: true,
    });

    for (const v of recentVoids) {
      if (v._count >= 3 && v.userId && v.organizationId) {
        const existing = await db.anomalyFlag.findFirst({
          where: {
            type: "EXCESSIVE_VOIDS",
            userId: v.userId,
            isResolved: false,
            createdAt: { gte: oneHourAgo },
          },
        });
        if (!existing) {
          await db.anomalyFlag.create({
            data: {
              type: "EXCESSIVE_VOIDS",
              severity: "HIGH",
              organizationId: v.organizationId,
              branchId: v.branchId!,
              userId: v.userId,
              details: { voidCount: v._count, window: "1 hour" },
            },
          });
          created++;
        }
      }
    }

    // 2. High discount without manager role
    const recentDiscounts = await db.auditLog.findMany({
      where: { action: "APPLY_DISCOUNT", createdAt: { gte: oneDayAgo } },
      include: { user: { select: { tenantRole: { select: { name: true, scope: true } } } } },
    });

    for (const d of recentDiscounts) {
      const details = d.details as Record<string, unknown> | null;
      if (!details) continue;
      const gross = Number(details.grossAmount || 0);
      const disc = Number(details.totalDiscount || 0);
      if (gross > 0 && disc / gross > 0.5) {
        const roleName = d.user?.tenantRole?.name;
        const scope = d.user?.tenantRole?.scope;
        if (roleName !== "MANAGER" && roleName !== "SUPER_ADMIN" && scope !== "HQ") {
          const existing = await db.anomalyFlag.findFirst({
            where: {
              type: "HIGH_DISCOUNT",
              userId: d.userId,
              isResolved: false,
              createdAt: { gte: oneDayAgo },
            },
          });
          if (!existing && d.branchId && d.organizationId) {
            await db.anomalyFlag.create({
              data: {
                type: "HIGH_DISCOUNT",
                severity: "CRITICAL",
                organizationId: d.organizationId,
                branchId: d.branchId,
                userId: d.userId,
                details: { grossAmount: gross, discountAmount: disc, percentage: Math.round((disc / gross) * 100), entityId: d.entityId },
              },
            });
            created++;
          }
        }
      }
    }

    // 3. Off-hours clock-in
    const recentClockIns = await db.auditLog.findMany({
      where: { action: "CLOCK_IN", createdAt: { gte: oneDayAgo } },
      select: { id: true, branchId: true, userId: true, organizationId: true, createdAt: true },
    });

    for (const ci of recentClockIns) {
      if (!ci.branchId) continue;
      const wibOffset = 7 * 60 * 60 * 1000;
      const wibTime = new Date(ci.createdAt.getTime() + wibOffset);
      const wibHour = wibTime.getUTCHours();
      const wibMinute = wibTime.getUTCMinutes();
      const timeStr = `${String(wibHour).padStart(2, "0")}:${String(wibMinute).padStart(2, "0")}`;

      const dayMap: Record<number, string> = {
        0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
        4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
      };
      const dow = dayMap[wibTime.getUTCDay()];

      const hours = await db.operatingHour.findFirst({
        where: { branchId: ci.branchId, dayOfWeek: dow as DayOfWeek },
      });

      if (hours && !hours.isClosed) {
        if (timeStr < hours.openTime || timeStr > hours.closeTime) {
          const existing = await db.anomalyFlag.findFirst({
            where: {
              type: "OFF_HOURS_CLOCKIN",
              userId: ci.userId,
              isResolved: false,
              createdAt: { gte: oneDayAgo },
            },
          });
          if (!existing) {
            await db.anomalyFlag.create({
              data: {
                type: "OFF_HOURS_CLOCKIN",
                severity: "MEDIUM",
                organizationId: ci.organizationId,
                branchId: ci.branchId!,
                userId: ci.userId,
                details: {
                  clockInTime: timeStr,
                  branchOpen: hours.openTime,
                  branchClose: hours.closeTime,
                  dayOfWeek: dow,
                },
              },
            });
            created++;
          }
        }
      }
    }

    return created;
  }
}
