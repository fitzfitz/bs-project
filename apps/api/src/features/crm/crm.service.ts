import type { PrismaClient } from "@prisma/client";

interface SegmentRules {
  minVisits?: number;
  maxVisits?: number;
  lastVisitWithinDays?: number;
  lastVisitBeyondDays?: number;
  createdWithinDays?: number;
  minSpend?: number;
}

const AUTO_SEGMENTS: Record<string, SegmentRules> = {
  VIP: { minVisits: 10, lastVisitWithinDays: 60, minSpend: 2_000_000 },
  REGULAR: { minVisits: 3, lastVisitWithinDays: 60 },
  NEW: { maxVisits: 2, createdWithinDays: 30 },
  AT_RISK: { minVisits: 3, lastVisitBeyondDays: 60, lastVisitWithinDays: 120 },
  LAPSED: { minVisits: 1, lastVisitBeyondDays: 120 },
};

function daysDiff(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export const CrmService = {
  async getCustomerInsights(db: PrismaClient, branchId: string, customerId: string) {
    const transactions = await db.transaction.findMany({
      where: { branchId, customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    const totalVisits = transactions.length;
    const totalSpend = transactions.reduce((s, t) => s + t.netAmount, 0);
    const averageSpend = totalVisits > 0 ? totalSpend / totalVisits : 0;
    const lastVisitAt = transactions[0]?.createdAt ?? null;
    const daysSinceLastVisit = lastVisitAt ? daysDiff(lastVisitAt, new Date()) : null;

    const serviceCounts: Record<string, number> = {};
    for (const tx of transactions) {
      for (const item of tx.items) {
        if (item.name) serviceCounts[item.name] = (serviceCounts[item.name] || 0) + 1;
      }
    }
    const favoriteServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const customerMembership = await db.customerMembership.findUnique({
      where: { userId: customerId },
      select: { tier: true },
    });

    const customer = await db.user.findUnique({
      where: { id: customerId },
      select: { firstName: true, lastName: true, email: true },
    });

    // Check segment membership
    const membership = await db.customerSegmentMember.findFirst({
      where: { customerId, segment: { branchId } },
      include: { segment: { select: { name: true } } },
    });

    return {
      customerId,
      customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : "",
      email: customer?.email ?? "",
      totalVisits,
      totalSpend,
      averageSpend,
      lastVisitAt: lastVisitAt?.toISOString() ?? null,
      daysSinceLastVisit,
      favoriteServices,
      loyaltyTier: customerMembership?.tier ?? "BRONZE",
      segment: membership?.segment.name ?? null,
    };
  },

  async listBranchCustomers(
    db: PrismaClient,
    branchId: string,
    opts: { segment?: string; minVisits?: number; sortBy: string; page: number; limit: number },
  ) {
    // Get distinct customer IDs who transacted at this branch
    const customerTxs = await db.transaction.groupBy({
      by: ["customerId"],
      where: { branchId, status: "COMPLETED", customerId: { not: null } },
      _count: true,
      _sum: { netAmount: true },
      _max: { createdAt: true },
    });

    let filtered = customerTxs.filter((c) => c.customerId !== null);
    if (opts.minVisits) filtered = filtered.filter((c) => c._count >= opts.minVisits!);

    // Sort
    if (opts.sortBy === "spend") filtered.sort((a, b) => (b._sum.netAmount ?? 0) - (a._sum.netAmount ?? 0));
    else if (opts.sortBy === "visits") filtered.sort((a, b) => b._count - a._count);
    else filtered.sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0));

    const total = filtered.length;
    const paged = filtered.slice((opts.page - 1) * opts.limit, opts.page * opts.limit);

    const insights = await Promise.all(
      paged.map((c) => this.getCustomerInsights(db, branchId, c.customerId!)),
    );

    // Filter by segment name if requested
    const data = opts.segment
      ? insights.filter((i) => i.segment === opts.segment)
      : insights;

    return {
      data,
      total: opts.segment ? data.length : total,
      page: opts.page,
      limit: opts.limit,
      totalPages: Math.ceil((opts.segment ? data.length : total) / opts.limit),
    };
  },

  async recomputeSegments(db: PrismaClient, branchId: string, organizationId: string) {
    // Ensure auto-segments exist
    for (const [name, rules] of Object.entries(AUTO_SEGMENTS)) {
      await db.customerSegment.upsert({
        where: { id: `auto_${branchId}_${name}` },
        create: {
          id: `auto_${branchId}_${name}`,
          organizationId,
          branchId,
          name,
          rules: rules as any,
          isAutomatic: true,
        },
        update: { rules: rules as any },
      });
    }

    const segments = await db.customerSegment.findMany({
      where: { branchId, isAutomatic: true },
    });

    // Get all customers for this branch
    const customerIds = await db.transaction.groupBy({
      by: ["customerId"],
      where: { branchId, status: "COMPLETED", customerId: { not: null } },
      _count: true,
      _sum: { netAmount: true },
      _max: { createdAt: true },
    });

    const now = new Date();
    let totalAssigned = 0;

    for (const seg of segments) {
      const rules = seg.rules as SegmentRules;
      // Clear old members
      await db.customerSegmentMember.deleteMany({ where: { segmentId: seg.id } });

      const matching: string[] = [];
      for (const row of customerIds) {
        if (!row.customerId) continue;
        const visits = row._count;
        const spend = row._sum.netAmount ?? 0;
        const lastVisit = row._max.createdAt;
        const daysSince = lastVisit ? daysDiff(lastVisit, now) : 999;

        let match = true;
        if (rules.minVisits !== undefined && visits < rules.minVisits) match = false;
        if (rules.maxVisits !== undefined && visits > rules.maxVisits) match = false;
        if (rules.minSpend !== undefined && spend < rules.minSpend) match = false;
        if (rules.lastVisitWithinDays !== undefined && daysSince > rules.lastVisitWithinDays) match = false;
        if (rules.lastVisitBeyondDays !== undefined && daysSince < rules.lastVisitBeyondDays) match = false;

        if (rules.createdWithinDays !== undefined) {
          const user = await db.user.findUnique({
            where: { id: row.customerId },
            select: { createdAt: true },
          });
          if (user && daysDiff(user.createdAt, now) > rules.createdWithinDays) match = false;
        }

        if (match) matching.push(row.customerId);
      }

      if (matching.length > 0) {
        await db.customerSegmentMember.createMany({
          data: matching.map((customerId) => ({ segmentId: seg.id, customerId, organizationId: seg.organizationId })),
          skipDuplicates: true,
        });
        totalAssigned += matching.length;
      }
    }

    return { segmentsProcessed: segments.length, totalAssigned };
  },

  async listSegments(db: PrismaClient, branchId: string) {
    const segments = await db.customerSegment.findMany({
      where: { branchId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });

    return segments.map((s) => ({
      id: s.id,
      name: s.name,
      memberCount: s._count.members,
      isAutomatic: s.isAutomatic,
    }));
  },
};
