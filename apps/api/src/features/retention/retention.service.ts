import type { PrismaClient } from "@prisma/client";
import type { NotificationService } from "../../utils/notifications";

const NUDGE_COOLDOWN_DAYS = 14;

/**
 * We use the audit log as a lightweight "nudge sent" tracker.
 * AuditAction enum doesn't have a NUDGE value, so we repurpose
 * a JSON detail flag. Alternative: a dedicated NudgeLog table.
 */
async function wasNudgedRecently(db: PrismaClient, userId: string): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NUDGE_COOLDOWN_DAYS);

  const recent = await db.auditLog.findFirst({
    where: {
      userId,
      action: "CREATE",
      entityType: "RetentionNudge",
      createdAt: { gte: cutoff },
    },
  });
  return !!recent;
}

async function recordNudge(db: PrismaClient, userId: string, organizationId: string, nudgeType: string) {
  await db.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "CREATE",
      entityType: "RetentionNudge",
      entityId: userId,
      details: { type: nudgeType, sentAt: new Date().toISOString() },
    },
  });
}

export const RetentionService = {
  async processRetentionTriggers(db: PrismaClient, notificationService: NotificationService) {
    const now = new Date();
    let atRiskSent = 0;
    let expirySent = 0;

    // 1. At-risk nudge: customers with last transaction 30-60 days ago
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const atRiskTxs = await db.transaction.groupBy({
      by: ["customerId"],
      where: {
        status: "COMPLETED",
        customerId: { not: null },
      },
      _max: { createdAt: true },
      having: {
        createdAt: {
          _max: { gte: sixtyDaysAgo, lte: thirtyDaysAgo },
        },
      },
    });

    for (const row of atRiskTxs) {
      if (!row.customerId) continue;
      if (await wasNudgedRecently(db, row.customerId)) continue;

      const user = await db.user.findUnique({ where: { id: row.customerId }, select: { organizationId: true } });
      if (!user) continue;

      await notificationService.sendPush(
        row.customerId,
        "We miss you!",
        "It's been a while since your last visit. Book now and get a special offer!",
      );
      await recordNudge(db, row.customerId, user.organizationId, "AT_RISK");
      atRiskSent++;
    }

    // 2. Points expiry warning: 7 days before expiry
    const sevenDaysOut = new Date(now);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const expiringAccounts = await db.customerMembership.findMany({
      where: {
        pointsExpiringAt: { gte: now, lte: sevenDaysOut },
        pointsBalance: { gt: 0 },
      },
    });

    for (const account of expiringAccounts) {
      if (await wasNudgedRecently(db, account.userId)) continue;

      await notificationService.sendPush(
        account.userId,
        "Your points are expiring!",
        `You have ${account.pointsBalance} points expiring soon. Use them before they're gone!`,
      );
      await recordNudge(db, account.userId, account.organizationId, "POINTS_EXPIRY");
      expirySent++;
    }

    return { atRiskSent, expirySent };
  },

  async getStats(db: PrismaClient) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalNudges, recentNudges] = await Promise.all([
      db.auditLog.count({
        where: { entityType: "RetentionNudge" },
      }),
      db.auditLog.count({
        where: { entityType: "RetentionNudge", createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return { totalNudges, last30Days: recentNudges };
  },
};
