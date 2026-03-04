import type { PrismaClient, CampaignStatus } from "@prisma/client";
import type { z } from "zod";
import type { createCampaignSchema, updateCampaignSchema, listCampaignsQuery } from "./campaigns.schema";
import type { NotificationService } from "../../utils/notifications";

type CreateInput = z.infer<typeof createCampaignSchema>;
type UpdateInput = z.infer<typeof updateCampaignSchema>;
type ListInput = z.infer<typeof listCampaignsQuery>;

export const CampaignService = {
  async create(db: PrismaClient, data: CreateInput, userId: string, organizationId: string) {
    if (data.promoCodeId) {
      const promo = await db.promoCode.findUnique({ where: { id: data.promoCodeId } });
      if (!promo || !promo.isActive) throw new Error("Invalid or inactive promo code");
    }
    if (data.segmentId) {
      const seg = await db.customerSegment.findUnique({ where: { id: data.segmentId } });
      if (!seg) throw new Error("Segment not found");
    }

    const campaign = await db.campaign.create({
      data: {
        organizationId,
        branchId: data.branchId,
        name: data.name,
        description: data.description,
        type: data.type,
        promoCodeId: data.promoCodeId,
        segmentId: data.segmentId,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        status: "DRAFT",
      },
    });

    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "CREATE_CAMPAIGN",
        entityType: "Campaign",
        entityId: campaign.id,
        branchId: data.branchId,
        details: { name: data.name, type: data.type },
      },
    });

    return campaign;
  },

  async update(db: PrismaClient, id: string, data: UpdateInput) {
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) throw new Error("Campaign not found");
    if (!["DRAFT", "SCHEDULED"].includes(existing.status)) {
      throw new Error("Only DRAFT or SCHEDULED campaigns can be edited");
    }

    return db.campaign.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.promoCodeId !== undefined ? { promoCodeId: data.promoCodeId } : {}),
        ...(data.segmentId !== undefined ? { segmentId: data.segmentId } : {}),
        ...(data.status !== undefined ? { status: data.status as CampaignStatus } : {}),
        ...(data.startsAt !== undefined ? { startsAt: new Date(data.startsAt) } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
      },
    });
  },

  async list(db: PrismaClient, query: ListInput) {
    const where: any = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      db.campaign.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
      db.campaign.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  },

  async getById(db: PrismaClient, id: string) {
    return db.campaign.findUnique({ where: { id } });
  },

  async sendCampaign(db: PrismaClient, campaignId: string, notificationService: NotificationService) {
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error("Campaign not found");
    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      throw new Error("Campaign cannot be sent in its current status");
    }

    let recipientIds: string[] = [];

    if (campaign.segmentId) {
      const members = await db.customerSegmentMember.findMany({
        where: { segmentId: campaign.segmentId },
        select: { customerId: true },
      });
      recipientIds = members.map((m) => m.customerId);
    } else if (campaign.branchId) {
      const txs = await db.transaction.groupBy({
        by: ["customerId"],
        where: { branchId: campaign.branchId, status: "COMPLETED", customerId: { not: null } },
      });
      recipientIds = txs.map((t) => t.customerId!).filter(Boolean);
    }

    let sent = 0;
    for (const userId of recipientIds) {
      if (campaign.type === "PUSH") {
        const ok = await notificationService.sendPush(
          userId,
          campaign.name,
          campaign.description ?? "",
          campaign.promoCodeId ? { promoCodeId: campaign.promoCodeId } : undefined,
        );
        if (ok) sent++;
      } else {
        // IN_APP / EMAIL: log for now
        console.log(`[campaigns] ${campaign.type} → ${userId}: ${campaign.name}`);
        sent++;
      }
    }

    await db.campaign.update({
      where: { id: campaignId },
      data: { sentCount: sent, status: "ACTIVE" },
    });

    return { sent, recipientCount: recipientIds.length };
  },

  async deleteCampaign(db: PrismaClient, id: string) {
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) throw new Error("Campaign not found");
    return db.campaign.delete({ where: { id } });
  },
};
