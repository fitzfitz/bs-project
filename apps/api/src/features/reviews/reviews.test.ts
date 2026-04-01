import { describe, it, expect, vi, beforeEach } from "vitest";
import reviewsApp from "./reviews.index";
import {
  createReviewSchema,
  listReviewsQuery,
  moderateReviewSchema,
} from "./reviews.schema";
import { ReviewService } from "./reviews.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("reviews schema", () => {
  it("createReviewSchema requires branchId and rating 1-5", () => {
    expect(createReviewSchema.safeParse({ branchId: "b1", rating: 0 }).success).toBe(false);
    expect(
      createReviewSchema.safeParse({ branchId: "b1", rating: 5, comment: "ok" }).success,
    ).toBe(true);
  });

  it("listReviewsQuery defaults includeHidden false", () => {
    const q = listReviewsQuery.parse({});
    expect(q.includeHidden).toBe(false);
  });

  it("moderateReviewSchema requires isVisible", () => {
    expect(moderateReviewSchema.safeParse({}).success).toBe(false);
    expect(moderateReviewSchema.safeParse({ isVisible: true }).success).toBe(true);
  });
});

describe("ReviewService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("createReview throws when customer has no paid visit", async () => {
    (db.queueEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      ReviewService.createReview(db, "c1", "org-1", {
        branchId: "b1",
        rating: 5,
        photoUrls: [],
      }),
    ).rejects.toThrow(/only review branches/);
  });

  it("createReview throws when queueEntry already reviewed", async () => {
    (db.queueEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "q1", status: "PAID" });
    (db.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });
    await expect(
      ReviewService.createReview(db, "c1", "org-1", {
        branchId: "b1",
        rating: 5,
        queueEntryId: "q1",
        photoUrls: [],
      }),
    ).rejects.toThrow(/already reviewed/);
  });

  it("createReview succeeds and recalculates aggregates", async () => {
    (db.queueEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "q1", status: "PAID" });
    (db.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.review.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r1",
      customerId: "c1",
      staffProfileId: "s1",
      branchId: "b1",
      rating: 5,
      comment: null,
      photoUrls: [],
      isVisible: true,
      createdAt: new Date(),
      customer: { firstName: "A", lastName: "B" },
      staff: { user: { firstName: "S", lastName: "T" } },
    });
    (db.review.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _avg: { rating: 5 },
      _count: 1,
    });
    (db.staffProfile.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.branch.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const row = await ReviewService.createReview(db, "c1", "org-1", {
      branchId: "b1",
      staffProfileId: "s1",
      rating: 5,
      photoUrls: [],
    });
    expect(row.id).toBe("r1");
    expect(db.review.create).toHaveBeenCalled();
    expect(db.staffProfile.update).toHaveBeenCalled();
    expect(db.branch.update).toHaveBeenCalled();
  });

  it("listReviews hides non-visible by default", async () => {
    (db.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.review.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    await ReviewService.listReviews(db, {
      page: 1,
      limit: 20,
      includeHidden: false,
    });
    expect(db.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isVisible: true }),
      }),
    );
  });

  it("getReviewById delegates to prisma", async () => {
    (db.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await ReviewService.getReviewById(db, "nope");
    expect(r).toBeNull();
  });
});

describe("reviews HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "REVIEWS", canUpdate: true, canDelete: true },
    ]);
  });

  it("GET / returns 200 for public list", async () => {
    (db.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.review.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request("http://t/?page=1&limit=20", { method: "GET" }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /:id returns 404 when missing", async () => {
    (db.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request("http://t/missing-id", { method: "GET" }, env);
    expect(res.status).toBe(404);
  });

  it("POST / returns 401 without token", async () => {
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: "b1", rating: 5, photoUrls: [] }),
    }, env);
    expect(res.status).toBe(401);
  });

  it("POST / returns 403 when customer has not visited branch", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.queueEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branchId: "b1", rating: 5, photoUrls: [] }),
    }, env);
    expect(res.status).toBe(403);
  });

  it("PATCH /:id/moderate returns 403 without REVIEWS update", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request("http://t/r1/moderate", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isVisible: false }),
    }, env);
    expect(res.status).toBe(403);
  });

  it("DELETE /:id returns 403 without REVIEWS delete", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "REVIEWS", canUpdate: true }]);
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request("http://t/r1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(403);
  });

  it("POST / returns 201 with valid body when service succeeds", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const createdAt = new Date("2025-06-01T12:00:00.000Z");
    const reviewRow = {
      id: "rev-new",
      customerId: testUsers.customer.userId,
      staffProfileId: "s1",
      branchId: "b1",
      rating: 5,
      comment: "Great",
      photoUrls: [] as string[],
      isVisible: true,
      createdAt,
      customer: { firstName: "Pat", lastName: "Lee" },
      staff: { user: { firstName: "Sam", lastName: "Kim" } },
    };
    const spy = vi.spyOn(ReviewService, "createReview").mockResolvedValue(reviewRow as never);
    try {
      const app = mountFeatureWithDb(reviewsApp, db);
      const res = await app.request(
        "http://t/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ branchId: "b1", rating: 5, photoUrls: [] }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; data: { id: string; rating: number } };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("rev-new");
      expect(body.data.rating).toBe(5);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("POST / returns 400 when body omits required rating", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(reviewsApp, db);
    const res = await app.request(
      "http://t/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchId: "b1", photoUrls: [] }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});
