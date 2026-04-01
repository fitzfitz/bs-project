import type { ChurnRiskLevel, PrismaClient } from "@prisma/client";

function computeRiskLevel(score: number): ChurnRiskLevel {
  if (score >= 0.7) return "CRITICAL";
  if (score >= 0.5) return "HIGH";
  if (score >= 0.3) return "MEDIUM";
  return "LOW";
}

export class ChurnService {
  static async computeChurnScores(db: PrismaClient, branchId: string, organizationId: string) {
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

    const customerTxs = await db.transaction.groupBy({
      by: ["customerId"],
      where: {
        branchId,
        status: "COMPLETED",
        customerId: { not: null },
      },
      _count: true,
      _max: { createdAt: true },
      _avg: { netAmount: true },
    });

    const distribution: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    let scored = 0;

    for (const ctxGroup of customerTxs) {
      if (!ctxGroup.customerId) continue;
      const customerId = ctxGroup.customerId;

      const lastVisit = ctxGroup._max.createdAt;
      const daysSinceLastVisit = lastVisit
        ? Math.floor((now.getTime() - lastVisit.getTime()) / 86400000)
        : 365;
      const recencyScore = Math.exp(-daysSinceLastVisit / 30);

      const recentTxCount = await db.transaction.count({
        where: { customerId, branchId, status: "COMPLETED", createdAt: { gte: ninetyDaysAgo } },
      });
      const historicalAvg = Math.max(3, ctxGroup._count / Math.max(1, Math.ceil(daysSinceLastVisit / 90)));
      const frequencyScore = Math.min(1.0, recentTxCount / historicalAvg);

      const recentTxs = await db.transaction.findMany({
        where: { customerId, branchId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { netAmount: true },
      });
      const recentAvgSpend =
        recentTxs.length > 0 ? recentTxs.reduce((s, t) => s + t.netAmount, 0) / recentTxs.length : 0;
      const overallAvgSpend = ctxGroup._avg.netAmount ?? 1;
      const monetaryScore =
        overallAvgSpend > 0 ? Math.min(1.0, recentAvgSpend / overallAvgSpend) : 0.5;

      let engagement = 0;
      const [hasLoyalty, hasReview, hasReferral] = await Promise.all([
        db.customerMembership.findUnique({ where: { userId: customerId }, select: { id: true } }),
        db.review.findFirst({
          where: { customerId, createdAt: { gte: ninetyDaysAgo } },
          select: { id: true },
        }),
        db.referral.findFirst({ where: { referrerId: customerId }, select: { id: true } }),
      ]);
      if (hasLoyalty) engagement += 0.3;
      if (hasReview) engagement += 0.3;
      if (hasReferral) engagement += 0.2;
      if (hasLoyalty) {
        const pointsActivity = await db.loyaltyTransaction.findFirst({
          where: { membership: { userId: customerId }, createdAt: { gte: ninetyDaysAgo } },
          select: { id: true },
        });
        if (pointsActivity) engagement += 0.2;
      }

      const healthScore =
        0.35 * recencyScore + 0.3 * frequencyScore + 0.2 * monetaryScore + 0.15 * engagement;
      const churnProbability = Math.round((1.0 - healthScore) * 100) / 100;
      const riskLevel = computeRiskLevel(churnProbability);

      const features = {
        recencyDays: daysSinceLastVisit,
        recencyScore: Math.round(recencyScore * 100) / 100,
        frequencyScore: Math.round(frequencyScore * 100) / 100,
        recentVisits: recentTxCount,
        monetaryScore: Math.round(monetaryScore * 100) / 100,
        monetaryTrend:
          overallAvgSpend > 0
            ? Math.round(((recentAvgSpend - overallAvgSpend) / overallAvgSpend) * 100) / 100
            : 0,
        engagementScore: Math.round(engagement * 100) / 100,
      };

      await db.churnScore.upsert({
        where: { customerId_branchId: { customerId, branchId } },
        create: { customerId, branchId, organizationId, score: churnProbability, riskLevel, features },
        update: { score: churnProbability, riskLevel, features, computedAt: now },
      });

      distribution[riskLevel]++;
      scored++;
    }

    return { customersScored: scored, riskDistribution: distribution };
  }

  static async getChurnScores(
    db: PrismaClient,
    branchId: string,
    opts: { riskLevel?: string; minScore?: number; page: number; limit: number },
  ) {
    const where: Record<string, unknown> = { branchId };
    if (opts.riskLevel) where.riskLevel = opts.riskLevel;
    if (opts.minScore !== undefined) where.score = { gte: opts.minScore };

    const [scores, total] = await Promise.all([
      db.churnScore.findMany({
        where,
        include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { score: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      db.churnScore.count({ where }),
    ]);

    return {
      data: scores.map((s) => ({
        customerId: s.customerId,
        customerName: `${s.customer.firstName} ${s.customer.lastName}`,
        customerEmail: s.customer.email,
        score: s.score,
        riskLevel: s.riskLevel,
        features: s.features,
        computedAt: s.computedAt.toISOString(),
      })),
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getCustomerChurnScore(db: PrismaClient, customerId: string, branchId: string) {
    const score = await db.churnScore.findUnique({
      where: { customerId_branchId: { customerId, branchId } },
      include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!score) return null;

    return {
      customerId: score.customerId,
      customerName: `${score.customer.firstName} ${score.customer.lastName}`,
      customerEmail: score.customer.email,
      score: score.score,
      riskLevel: score.riskLevel,
      features: score.features,
      computedAt: score.computedAt.toISOString(),
    };
  }
}
