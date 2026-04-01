import type { PrismaClient, Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { ConfigService } from "../config/config.service";

type TxClient = Prisma.TransactionClient;

function generateCode(firstName: string): string {
  const prefix = firstName.slice(0, 3).toUpperCase().padEnd(3, "X");
  const suffix = String(randomInt(1000, 9999));
  return `${prefix}${suffix}`;
}

export const ReferralService = {
  async getOrCreateReferralCode(db: PrismaClient, userId: string): Promise<string> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, firstName: true },
    });
    if (!user) throw new Error("User not found");

    const membership = await db.customerMembership.findUnique({
      where: { userId },
      select: { referralCode: true },
    });
    if (membership?.referralCode) return membership.referralCode;

    let code = generateCode(user.firstName);
    let attempts = 0;
    while (attempts < 10) {
      const exists = await db.customerMembership.findFirst({
        where: { organizationId: user.organizationId, referralCode: code },
        select: { id: true },
      });
      if (!exists) break;
      code = generateCode(user.firstName);
      attempts++;
    }

    await db.customerMembership.upsert({
      where: { userId },
      create: {
        userId,
        organizationId: user.organizationId,
        referralCode: code,
        pointsBalance: 0,
        lifetimePoints: 0,
      },
      update: { referralCode: code },
    });
    return code;
  },

  async applyReferralCode(db: PrismaClient, newUserId: string, referralCode: string) {
    const referee = await db.user.findUnique({
      where: { id: newUserId },
      select: { organizationId: true },
    });
    if (!referee) throw new Error("User not found");

    const referrerMembership = await db.customerMembership.findFirst({
      where: { organizationId: referee.organizationId, referralCode },
      select: { userId: true },
    });
    if (!referrerMembership) throw new Error("Invalid referral code");
    const referrerId = referrerMembership.userId;
    if (referrerId === newUserId) throw new Error("Cannot refer yourself");

    const existing = await db.referral.findUnique({
      where: { referrerId_refereeId: { referrerId, refereeId: newUserId } },
    });
    if (existing) throw new Error("Referral already applied");

    const [expiryDays, bonusPoints] = await Promise.all([
      ConfigService.getNumericConfig(db, "REFERRAL_EXPIRY_DAYS", 30),
      ConfigService.getNumericConfig(db, "REFERRAL_BONUS_POINTS", 50),
    ]);
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const referral = await db.referral.create({
      data: {
        organizationId: referee.organizationId,
        referrerId,
        refereeId: newUserId,
        bonusPoints,
        expiresAt,
        status: "PENDING",
      },
    });

    return referral;
  },

  /**
   * Called when a referred user completes their first transaction.
   * Awards bonus points to the referrer.
   */
  async completeReferral(tx: TxClient, refereeId: string) {
    const referral = await tx.referral.findFirst({
      where: { refereeId, status: "PENDING" },
    });
    if (!referral) return null;

    if (referral.expiresAt && referral.expiresAt < new Date()) {
      await tx.referral.update({
        where: { id: referral.id },
        data: { status: "EXPIRED" },
      });
      return null;
    }

    const { LoyaltyService } = await import("../loyalty/loyalty.service");
    await LoyaltyService.addBonusPoints(
      tx,
      referral.referrerId,
      referral.bonusPoints,
      `Referral bonus: friend completed first visit`,
    );

    const updated = await tx.referral.update({
      where: { id: referral.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        organizationId: referral.organizationId,
        userId: referral.referrerId,
        action: "REFERRAL_REWARD",
        entityType: "Referral",
        entityId: referral.id,
        details: {
          refereeId,
          bonusPoints: referral.bonusPoints,
        },
      },
    });

    return updated;
  },

  async getReferralHistory(db: PrismaClient, userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      db.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          referee: { select: { firstName: true, lastName: true, createdAt: true } },
        },
      }),
      db.referral.count({ where: { referrerId: userId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getReferralStats(db: PrismaClient) {
    const [total, completed, pending] = await Promise.all([
      db.referral.count(),
      db.referral.count({ where: { status: "COMPLETED" } }),
      db.referral.count({ where: { status: "PENDING" } }),
    ]);
    return { total, completed, pending, conversionRate: total > 0 ? completed / total : 0 };
  },
};
