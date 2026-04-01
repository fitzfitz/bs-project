import { describe, it, expect, vi, beforeEach } from "vitest";
import { joinWaitlistBody } from "./waitlist.schema";
import { WaitlistService } from "./waitlist.service";
import waitlistApp from "./waitlist.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";
import { ConfigService } from "../config/config.service";

describe("waitlist.schema", () => {
  it("joinWaitlistBody accepts valid payload", () => {
    const r = joinWaitlistBody.safeParse({
      branchId: "b1",
      preferredDate: "2025-07-01",
      preferredTimeSlot: "10:00",
      serviceIds: ["s1"],
    });
    expect(r.success).toBe(true);
  });

  it("joinWaitlistBody rejects bad date", () => {
    expect(
      joinWaitlistBody.safeParse({
        branchId: "b1",
        preferredDate: "bad",
        preferredTimeSlot: "10:00",
        serviceIds: ["s1"],
      }).success,
    ).toBe(false);
  });
});

describe("WaitlistService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    ConfigService.clearCache();
  });

  it("joinWaitlist returns 400 when disabled", async () => {
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: "false",
    });
    await expect(
      WaitlistService.joinWaitlist(db, "org-1", "u1", {
        branchId: "b1",
        preferredDate: "2025-07-01",
        preferredTimeSlot: "10:00",
        serviceIds: ["s1"],
      }),
    ).rejects.toMatchObject({ status: 400, message: "Waitlist is not enabled" });
  });

  it("joinWaitlist creates entry when enabled", async () => {
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where: { key } }: { where: { key: string } }) => {
        if (key === "WAITLIST_ENABLED") return Promise.resolve({ value: "true" });
        if (key === "WAITLIST_MAX_PER_SLOT") return Promise.resolve({ value: "5" });
        return Promise.resolve(null);
      },
    );
    (db.branch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "b1" });
    (db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      firstName: "A",
      lastName: "B",
    });
    (db.waitlistEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.waitlistEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "w1",
      organizationId: "org-1",
      branchId: "b1",
      userId: "u1",
      customerName: "A B",
      status: "WAITING",
    });

    const out = await WaitlistService.joinWaitlist(db, "org-1", "u1", {
      branchId: "b1",
      preferredDate: "2025-07-01",
      preferredTimeSlot: "10:00",
      serviceIds: ["s1"],
    });

    expect(out.id).toBe("w1");
    expect(db.waitlistEntry.create).toHaveBeenCalled();
  });

  it("joinWaitlist returns 400 when slot is full", async () => {
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where: { key } }: { where: { key: string } }) => {
        if (key === "WAITLIST_ENABLED") return Promise.resolve({ value: "true" });
        if (key === "WAITLIST_MAX_PER_SLOT") return Promise.resolve({ value: "5" });
        return Promise.resolve(null);
      },
    );
    (db.branch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "b1" });
    (db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      firstName: "A",
      lastName: "B",
    });
    (db.waitlistEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    await expect(
      WaitlistService.joinWaitlist(db, "org-1", "u1", {
        branchId: "b1",
        preferredDate: "2025-07-01",
        preferredTimeSlot: "10:00",
        serviceIds: ["s1"],
      }),
    ).rejects.toMatchObject({ status: 400, message: "Waitlist is full for this time slot" });
  });

  it("getMyWaitlist lists non-expired active entries", async () => {
    const rows = [{ id: "w1" }];
    (db.waitlistEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows);
    const result = await WaitlistService.getMyWaitlist(db, "org-1", "u1");
    expect(result).toEqual(rows);
    expect(db.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          userId: "u1",
          status: { in: ["WAITING", "NOTIFIED"] },
        }),
      }),
    );
  });

  it("leaveWaitlist cancels own entry", async () => {
    (db.waitlistEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "w1",
      userId: "u1",
      status: "WAITING",
    });
    (db.waitlistEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "w1",
      status: "CANCELLED",
    });
    const out = await WaitlistService.leaveWaitlist(db, "org-1", "u1", "w1");
    expect(out.status).toBe("CANCELLED");
  });

  it("expireWaitlistEntries updates stale rows", async () => {
    (db.waitlistEntry.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });
    const n = await WaitlistService.expireWaitlistEntries(db);
    expect(n).toBe(3);
  });
});

describe("waitlist HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    ConfigService.clearCache();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [{ featureCode: "QUEUE_MANAGEMENT", canRead: true }]);
  });

  it("POST / returns 401 without auth", async () => {
    const app = mountFeatureWithDb(waitlistApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: "b1",
        preferredDate: "2025-07-01",
        preferredTimeSlot: "10:00",
        serviceIds: ["s1"],
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST / returns 403 for staff user", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
      isCustomer: false,
    });
    const app = mountFeatureWithDb(waitlistApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branchId: "b1",
        preferredDate: "2025-07-01",
        preferredTimeSlot: "10:00",
        serviceIds: ["s1"],
      }),
    });
    expect(res.status).toBe(403);
  });

  it("POST / returns 201 for customer when service succeeds", async () => {
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where: { key } }: { where: { key: string } }) => {
        if (key === "WAITLIST_ENABLED") return Promise.resolve({ value: "true" });
        if (key === "WAITLIST_MAX_PER_SLOT") return Promise.resolve({ value: "5" });
        return Promise.resolve(null);
      },
    );
    (db.branch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "branch-1" });
    (db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      firstName: "C",
      lastName: "D",
    });
    (db.waitlistEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.waitlistEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "w-new",
      organizationId: "org-1",
      branchId: "branch-1",
      userId: testUsers.customer.userId,
      customerName: "C D",
      preferredDate: new Date("2025-07-01T00:00:00.000Z"),
      preferredTimeSlot: "10:00",
      serviceIds: ["s1"],
      status: "WAITING",
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(waitlistApp, db);
    const res = await app.request("http://t/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branchId: "branch-1",
        preferredDate: "2025-07-01",
        preferredTimeSlot: "10:00",
        serviceIds: ["s1"],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("w-new");
  });

  it("GET /me returns entries for customer", async () => {
    (db.waitlistEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(waitlistApp, db);
    const res = await app.request("http://t/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("GET /admin returns 200 for staff with QUEUE_MANAGEMENT read", async () => {
    (db.waitlistEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(waitlistApp, db);
    const res = await app.request("http://t/admin?branchId=branch-1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("GET /admin returns 403 without permission", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(waitlistApp, db);
    const res = await app.request("http://t/admin?branchId=branch-1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});
