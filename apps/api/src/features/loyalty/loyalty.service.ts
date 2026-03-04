import type { PrismaClient, Prisma, LoyaltyTierLevel } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const EARN_RATE = 10_000; // 1 point per 10,000 IDR
const REDEEM_RATE = 500; // 1 point = 500 IDR discount
const MAX_REDEEM_PERCENT = 0.5; // Max 50% of bill
const EXPIRY_MONTHS = 6;

const TIER_THRESHOLDS: Record<LoyaltyTierLevel, number> = {
  BRONZE: 0,
  SILVER: 200,
  GOLD: 500,
  PLATINUM: 1000,
};

const TIER_MULTIPLIERS: Record<LoyaltyTierLevel, number> = {
  BRONZE: 1.0,
  SILVER: 1.25,
  GOLD: 1.5,
  PLATINUM: 2.0,
};

const TIER_ORDER: LoyaltyTierLevel[] = ["PLATINUM", "GOLD", "SILVER", "BRONZE"];

function computeTier(lifetimePoints: number): LoyaltyTierLevel {
  for (const tier of TIER_ORDER) {
    if (lifetimePoints >= TIER_THRESHOLDS[tier]) return tier;
  }
  return "BRONZE";
}

function expiryDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + EXPIRY_MONTHS);
  return d;
}

export const LoyaltyService = {
  async earnPoints(
    tx: TxClient,
    customerId: string,
    posTransactionId: string,
    netAmount: number,
  ) {
    const user = await tx.user.findUnique({
      where: { id: customerId },
      select: { organizationId: true },
    });
    if (!user) throw new Error("User not found");
    const organizationId = user.organizationId;

    const account = await tx.customerMembership.upsert({
      where: { userId: customerId },
      create: {
        userId: customerId,
        organizationId,
        pointsBalance: 0,
        lifetimePoints: 0,
        lastActivityAt: new Date(),
        pointsExpiringAt: expiryDate(),
      },
      update: {},
    });

    const basePoints = Math.floor(netAmount / EARN_RATE);
    const pointsEarned = Math.floor(basePoints * account.tierMultiplier);
    if (pointsEarned <= 0) return { pointsEarned: 0, tier: account.tier };

    const updated = await tx.customerMembership.update({
      where: { id: account.id },
      data: {
        pointsBalance: { increment: pointsEarned },
        lifetimePoints: { increment: pointsEarned },
        lastActivityAt: new Date(),
        pointsExpiringAt: expiryDate(),
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        customerMembershipId: account.id,
        organizationId,
        points: pointsEarned,
        description: `Earned from transaction ${posTransactionId}`,
        transactionId: posTransactionId,
      },
    });

    const tierResult = await this.checkAndUpgradeTier(tx, updated);

    return {
      pointsEarned,
      newBalance: updated.pointsBalance + pointsEarned,
      tier: tierResult.tier,
    };
  },

  async redeemPoints(
    tx: TxClient,
    customerId: string,
    points: number,
    posTransactionId: string,
    billNetAmount: number,
  ) {
    const account = await tx.customerMembership.findUnique({
      where: { userId: customerId },
    });
    if (!account) throw new Error("Customer membership not found");
    const organizationId = account.organizationId;
    if (account.pointsBalance < points)
      throw new Error("Insufficient loyalty points");

    const discountAmount = points * REDEEM_RATE;
    const maxAllowed = billNetAmount * MAX_REDEEM_PERCENT;
    if (discountAmount > maxAllowed)
      throw new Error(
        `Redemption exceeds ${MAX_REDEEM_PERCENT * 100}% of bill (max ${maxAllowed} IDR)`,
      );

    await tx.customerMembership.update({
      where: { id: account.id },
      data: {
        pointsBalance: { decrement: points },
        lastActivityAt: new Date(),
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        customerMembershipId: account.id,
        organizationId,
        points: -points,
        description: `Redeemed for transaction ${posTransactionId}`,
        transactionId: posTransactionId,
      },
    });

    return { pointsRedeemed: points, discountAmount };
  },

  async checkAndUpgradeTier(
    tx: TxClient,
    account: { id: string; lifetimePoints: number; tier: LoyaltyTierLevel },
  ) {
    const newTier = computeTier(account.lifetimePoints);
    if (newTier === account.tier) return { tier: account.tier, upgraded: false };

    await tx.customerMembership.update({
      where: { id: account.id },
      data: {
        tier: newTier,
        tierMultiplier: TIER_MULTIPLIERS[newTier],
      },
    });

    const membership = await tx.customerMembership.findUnique({
      where: { id: account.id },
      select: { organizationId: true },
    });
    if (membership) {
      await tx.auditLog.create({
        data: {
          organizationId: membership.organizationId,
          action: "TIER_UPGRADE",
          entityType: "CustomerMembership",
          entityId: account.id,
          details: {
            from: account.tier,
            to: newTier,
            lifetimePoints: account.lifetimePoints,
          },
        },
      });
    }

    return { tier: newTier, upgraded: true };
  },

  async processPointExpiry(db: PrismaClient) {
    const now = new Date();
    const expired = await db.customerMembership.findMany({
      where: {
        pointsExpiringAt: { lte: now },
        pointsBalance: { gt: 0 },
      },
    });

    let totalExpired = 0;
    for (const account of expired) {
      const points = account.pointsBalance;
      await db.customerMembership.update({
        where: { id: account.id },
        data: {
          pointsBalance: 0,
          pointsExpiringAt: null,
        },
      });
      await db.loyaltyTransaction.create({
        data: {
          customerMembershipId: account.id,
          organizationId: account.organizationId,
          points: -points,
          description: "Points expired due to inactivity",
        },
      });
      totalExpired += points;
    }

    return { accountsProcessed: expired.length, totalExpired };
  },

  async adjustPoints(
    db: PrismaClient,
    userId: string,
    points: number,
    description: string,
    adminUserId?: string,
    callerOrganizationId?: string,
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) throw new Error("User not found");
    const organizationId = user.organizationId;
    if (callerOrganizationId && callerOrganizationId !== organizationId) {
      throw new Error("User not in same organization");
    }

    const account = await db.customerMembership.upsert({
      where: { userId },
      create: {
        userId,
        organizationId,
        pointsBalance: Math.max(0, points),
        lifetimePoints: Math.max(0, points),
        lastActivityAt: new Date(),
      },
      update: {
        pointsBalance: { increment: points },
        ...(points > 0 ? { lifetimePoints: { increment: points } } : {}),
        lastActivityAt: new Date(),
      },
    });

    await db.loyaltyTransaction.create({
      data: {
        customerMembershipId: account.id,
        organizationId,
        points,
        description,
      },
    });

    if (adminUserId) {
      const adminUser = await db.user.findUnique({
        where: { id: adminUserId },
        select: { organizationId: true },
      });
      if (adminUser) {
        await db.auditLog.create({
          data: {
            organizationId: adminUser.organizationId,
            userId: adminUserId,
            action: points > 0 ? "EARN_POINTS" : "REDEEM_POINTS",
            entityType: "CustomerMembership",
            entityId: account.id,
            details: { points, description, adjustedBy: adminUserId },
          },
        });
      }
    }

    return account;
  },

  /** Award bonus points (used by referral system). */
  async addBonusPoints(
    tx: TxClient,
    userId: string,
    points: number,
    description: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) throw new Error("User not found");
    const organizationId = user.organizationId;

    const account = await tx.customerMembership.upsert({
      where: { userId },
      create: {
        userId,
        organizationId,
        pointsBalance: points,
        lifetimePoints: points,
        lastActivityAt: new Date(),
        pointsExpiringAt: expiryDate(),
      },
      update: {
        pointsBalance: { increment: points },
        lifetimePoints: { increment: points },
        lastActivityAt: new Date(),
        pointsExpiringAt: expiryDate(),
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        customerMembershipId: account.id,
        organizationId,
        points,
        description,
      },
    });

    await this.checkAndUpgradeTier(tx, {
      id: account.id,
      lifetimePoints: account.lifetimePoints + points,
      tier: account.tier,
    });

    return account;
  },
};
