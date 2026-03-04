import { PrismaClient } from '@prisma/client';
import { ValidatePromoCodeInput, CreatePromoCodeInput, UpdatePromoCodeInput } from './promotions.schema';
import { HTTPException } from 'hono/http-exception';

export class PromotionsService {
  async listPromoCodes(db: PrismaClient, branchId?: string) {
    return db.promoCode.findMany({
      where: branchId ? { OR: [{ branchId }, { branchId: null }] } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPromoCodeByCode(db: PrismaClient, code: string, organizationId: string) {
    return db.promoCode.findFirst({
      where: { code, organizationId },
    });
  }

  async createPromoCode(db: PrismaClient, data: CreatePromoCodeInput, organizationId: string) {
    return db.promoCode.create({
      data: {
        ...data,
        organizationId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  async updatePromoCode(db: PrismaClient, id: string, data: UpdatePromoCodeInput) {
    const existing = await db.promoCode.findUnique({ where: { id } });
    if (!existing) {
      throw new HTTPException(404, { message: 'Promo code not found' });
    }
    return db.promoCode.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.minGrossAmount !== undefined && { minGrossAmount: data.minGrossAmount }),
        ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
        ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.branchId !== undefined && { branchId: data.branchId }),
      },
    });
  }

  async deletePromoCode(db: PrismaClient, id: string) {
    const existing = await db.promoCode.findUnique({ where: { id } });
    if (!existing) {
      throw new HTTPException(404, { message: 'Promo code not found' });
    }
    return db.promoCode.delete({ where: { id } });
  }

  async validatePromoCode(db: PrismaClient, input: ValidatePromoCodeInput) {
    const organizationId = input.organizationId;
    if (!organizationId) {
      throw new HTTPException(400, { message: "Organization context required for promo validation" });
    }
    const promo = await this.getPromoCodeByCode(db, input.code, organizationId!);

    if (!promo) {
      throw new HTTPException(404, { message: 'Promo code not found' });
    }

    if (!promo.isActive) {
      throw new HTTPException(400, { message: 'Promo code is inactive' });
    }

    if (promo.branchId && promo.branchId !== input.branchId) {
      throw new HTTPException(400, { message: 'Promo code not valid for this branch' });
    }

    const now = new Date();
    if (promo.startDate > now) {
      throw new HTTPException(400, { message: 'Promo code is not yet active' });
    }

    if (promo.endDate && promo.endDate < now) {
      throw new HTTPException(400, { message: 'Promo code has expired' });
    }

    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new HTTPException(400, { message: 'Promo code usage limit reached' });
    }

    if (input.grossAmount < promo.minGrossAmount) {
      throw new HTTPException(400, { 
        message: `Minimum gross amount of ${promo.minGrossAmount} required to use this promo code` 
      });
    }

    let discountAmount = 0;
    if (promo.type === 'PERCENTAGE') {
      discountAmount = (input.grossAmount * promo.value) / 100;
      if (promo.maxDiscount !== null && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else {
      discountAmount = promo.value;
    }

    return {
      promoCode: promo.code,
      discountAmount,
      type: promo.type,
      value: promo.value,
    };
  }

  async validateLoyaltyRedemption(db: PrismaClient, userId: string, pointsToRedeem: number, netAmount: number) {
    const account = await db.customerMembership.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new HTTPException(404, { message: 'Customer membership not found' });
    }

    if (account.pointsBalance < pointsToRedeem) {
      throw new HTTPException(400, { message: 'Insufficient loyalty points' });
    }

    // Example pointsRedeemRate = 500 (1 point = 500 IDR discount)
    const pointsRedeemRate = 500;
    const discountAmount = pointsToRedeem * pointsRedeemRate;

    if (discountAmount > netAmount) {
       throw new HTTPException(400, { message: 'Discount amount exceeds transaction total' });
    }

    // Max redemption percent check (e.g., max 50% of bill)
    const maxRedemptionPercent = 50;
    const maxDiscount = (netAmount * maxRedemptionPercent) / 100;
    if (discountAmount > maxDiscount) {
       throw new HTTPException(400, { message: `Maximum loyalty discount allowed is ${maxRedemptionPercent}% (${maxDiscount})` });
    }

    return {
      pointsToRedeem,
      discountAmount,
    };
  }
}

export const promotionsService = new PromotionsService();
