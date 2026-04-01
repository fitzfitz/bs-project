import { describe, it, expect, vi, beforeEach } from "vitest";
import campaignsApp from "./campaigns.index";
import { createCampaignSchema, updateCampaignSchema, listCampaignsQuery } from "./campaigns.schema";
import { CampaignService } from "./campaigns.service";
import {
  createMockDb,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("campaigns schema", () => {
  it("createCampaignSchema requires type and startsAt", () => {
    expect(
      createCampaignSchema.safeParse({
        name: "X",
        type: "EMAIL",
        startsAt: "not-a-date",
      }).success,
    ).toBe(false);
    expect(
      createCampaignSchema.safeParse({
        name: "X",
        type: "EMAIL",
        startsAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });

  it("updateCampaignSchema allows partial fields", () => {
    expect(updateCampaignSchema.safeParse({ name: "Y" }).success).toBe(true);
  });

  it("listCampaignsQuery defaults page and limit", () => {
    const q = listCampaignsQuery.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
  });
});

describe("CampaignService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("create throws when promo inactive", async () => {
    (db.promoCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ isActive: false });
    await expect(
      CampaignService.create(
        db,
        {
          name: "C1",
          type: "EMAIL",
          startsAt: new Date().toISOString(),
          promoCodeId: "p1",
        },
        "u1",
        "org-1",
      ),
    ).rejects.toThrow(/Invalid or inactive promo/);
  });

  it("create throws when segment missing", async () => {
    (db.customerSegment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      CampaignService.create(
        db,
        {
          name: "C1",
          type: "PUSH",
          startsAt: new Date().toISOString(),
          segmentId: "seg-missing",
        },
        "u1",
        "org-1",
      ),
    ).rejects.toThrow(/Segment not found/);
  });

  it("update throws when campaign not in draft-like status", async () => {
    (db.campaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ACTIVE" });
    await expect(
      CampaignService.update(db, "c1", { name: "N" }),
    ).rejects.toThrow(/Only DRAFT or SCHEDULED/);
  });

  it("sendCampaign throws when status not sendable", async () => {
    (db.campaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ACTIVE",
      segmentId: null,
      branchId: null,
      type: "EMAIL",
      name: "Old",
      description: null,
      promoCodeId: null,
    });
    const ns = { sendPush: vi.fn(), sendSms: vi.fn() };
    await expect(CampaignService.sendCampaign(db, "c1", ns as never)).rejects.toThrow(
      /cannot be sent/,
    );
  });

  it("list builds pagination", async () => {
    (db.campaign.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.campaign.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const r = await CampaignService.list(db, { page: 1, limit: 10 });
    expect(r.totalPages).toBe(0);
    expect(db.campaign.findMany).toHaveBeenCalled();
  });
});

describe("campaigns HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  const env = getTestBindings();

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "CAMPAIGNS", canRead: true, canCreate: true, canUpdate: true, canDelete: true },
    ]);
  });

  it("GET / returns 401 without token", async () => {
    const app = mountFeatureWithDb(campaignsApp, db);
    const res = await app.request("http://t/?page=1&limit=20", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  it("GET / returns 200 when permitted", async () => {
    (db.campaign.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.campaign.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(campaignsApp, db);
    const res = await app.request("http://t/?page=1&limit=20", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id returns 403 without CAMPAIGNS delete", async () => {
    mockTenantRolePermissions(db, [{ featureCode: "CAMPAIGNS", canRead: true }]);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(campaignsApp, db);
    const res = await app.request("http://t/c1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(403);
  });

  it("POST / returns 201 with valid body", async () => {
    const startsAt = new Date("2025-07-01T12:00:00.000Z");
    const createdAt = new Date("2025-06-15T08:00:00.000Z");
    (db.campaign.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "camp-new",
      organizationId: "org-1",
      branchId: null,
      name: "Launch",
      description: null,
      type: "EMAIL",
      promoCodeId: null,
      segmentId: null,
      status: "DRAFT",
      startsAt,
      endsAt: null,
      sentCount: 0,
      openCount: 0,
      createdAt,
    });
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(campaignsApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Launch",
        type: "EMAIL",
        startsAt: startsAt.toISOString(),
      }),
    }, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; name: string } };
    expect(body.data.id).toBe("camp-new");
    expect(body.data.name).toBe("Launch");
  });

  it("PATCH /:id returns 400 when campaign is not found", async () => {
    (db.campaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(campaignsApp, db);
    const res = await app.request("http://t/missing-id", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Nope" }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/not found/i);
  });

  it("POST /:id/send returns 400 when campaign is not sendable", async () => {
    (db.campaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ACTIVE",
      segmentId: null,
      branchId: null,
      type: "EMAIL",
      name: "Sent already",
      description: null,
      promoCodeId: null,
    });
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(campaignsApp, db);
    const res = await app.request("http://t/c1/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/cannot be sent|current status/i);
  });
});
