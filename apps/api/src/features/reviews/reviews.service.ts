import type { PrismaClient } from "@prisma/client";
import type { createReviewSchema, listReviewsQuery, moderateReviewSchema } from "./reviews.schema";
import type { z } from "zod";

type CreateReviewInput = z.infer<typeof createReviewSchema>;
type ListReviewsInput = z.infer<typeof listReviewsQuery>;
type ModerateInput = z.infer<typeof moderateReviewSchema>;

export const ReviewService = {
  async createReview(db: PrismaClient, customerId: string, organizationId: string, data: CreateReviewInput) {
    // Verify the customer has a completed visit at this branch
    const visitWhere: any = {
      customerId,
      branchId: data.branchId,
      status: "PAID",
    };
    if (data.queueEntryId) visitWhere.id = data.queueEntryId;

    const visit = await db.queueEntry.findFirst({
      where: visitWhere,
      orderBy: { completedAt: "desc" },
    });
    if (!visit) throw new Error("You can only review branches you've visited");

    // Duplicate check
    if (data.queueEntryId) {
      const existing = await db.review.findUnique({
        where: { customerId_queueEntryId: { customerId, queueEntryId: data.queueEntryId } },
      });
      if (existing) throw new Error("You already reviewed this visit");
    }

    const review = await db.review.create({
      data: {
        organizationId,
        customerId,
        branchId: data.branchId,
        staffProfileId: data.staffProfileId,
        queueEntryId: data.queueEntryId,
        rating: data.rating,
        comment: data.comment,
        photoUrls: data.photoUrls,
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        staff: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    await this.recalculateAggregates(db, data.branchId, data.staffProfileId);
    return review;
  },

  async listReviews(db: PrismaClient, query: ListReviewsInput) {
    const where: any = {};
    if (!query.includeHidden) where.isVisible = true;
    if (query.branchId) where.branchId = query.branchId;
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.minRating) where.rating = { gte: query.minRating };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          staff: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      db.review.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  },

  async getReviewById(db: PrismaClient, id: string) {
    return db.review.findUnique({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        staff: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  },

  async moderateReview(db: PrismaClient, reviewId: string, moderatorId: string, data: ModerateInput) {
    const review = await db.review.update({
      where: { id: reviewId },
      data: { isVisible: data.isVisible },
    });

    await db.auditLog.create({
      data: {
        organizationId: review.organizationId,
        userId: moderatorId,
        action: "MODERATE_REVIEW",
        entityType: "Review",
        entityId: reviewId,
        details: { isVisible: data.isVisible, note: data.moderationNote },
      },
    });

    await this.recalculateAggregates(db, review.branchId ?? undefined, review.staffProfileId ?? undefined);
    return review;
  },

  async deleteReview(db: PrismaClient, reviewId: string) {
    const review = await db.review.delete({ where: { id: reviewId } });
    await this.recalculateAggregates(db, review.branchId ?? undefined, review.staffProfileId ?? undefined);
    return review;
  },

  async recalculateAggregates(db: PrismaClient, branchId?: string, staffProfileId?: string) {
    if (staffProfileId) {
      const agg = await db.review.aggregate({
        where: { staffProfileId, isVisible: true },
        _avg: { rating: true },
        _count: true,
      });
      await db.staffProfile.update({
        where: { id: staffProfileId },
        data: {
          averageRating: agg._avg.rating ?? 0,
          totalReviews: agg._count,
        },
      });
    }

    if (branchId) {
      const agg = await db.review.aggregate({
        where: { branchId, isVisible: true },
        _avg: { rating: true },
        _count: true,
      });
      await db.branch.update({
        where: { id: branchId },
        data: {
          averageRating: agg._avg.rating ?? 0,
          totalReviews: agg._count,
        },
      });
    }
  },
};
