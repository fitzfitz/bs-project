import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listNotificationsQuery,
  notificationIdParam,
  adminListQuery,
  testSendBody,
} from "./notifications.schema";
import notificationsApp from "./notifications.index";
import {
  createMockDb,
  signTestJwt,
  mountFeatureWithDb,
  mockTenantRolePermissions,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("notifications schema", () => {
  it("listNotificationsQuery defaults page=1 limit=20", () => {
    const parsed = listNotificationsQuery.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("listNotificationsQuery rejects page < 1", () => {
    expect(listNotificationsQuery.safeParse({ page: 0 }).success).toBe(false);
  });

  it("listNotificationsQuery rejects limit > 50", () => {
    expect(listNotificationsQuery.safeParse({ limit: 51 }).success).toBe(false);
  });

  it("notificationIdParam requires non-empty id", () => {
    expect(notificationIdParam.safeParse({ id: "" }).success).toBe(false);
    expect(notificationIdParam.safeParse({ id: "n1" }).success).toBe(true);
  });
});

describe("notifications HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when listing notifications without auth", async () => {
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with paginated notifications for authenticated user", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const mockNotifications = [
      {
        id: "n1",
        title: "Booking Confirmed",
        body: "Your booking is confirmed!",
        type: "BOOKING_CONFIRMED",
        data: null,
        read: false,
        createdAt: new Date(),
      },
    ];
    (db.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotifications);
    (db.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("returns 401 for unread-count without auth", async () => {
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/unread-count", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with unread count", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/unread-count", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(3);
  });

  it("returns 404 when marking notification that doesn't belong to user", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.notification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/n999/read", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 200 when marking a notification as read", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.notification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "n1",
      userId: testUsers.customer.userId,
      read: false,
    });
    (db.notification.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "n1",
      read: true,
    });

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/n1/read", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { read: boolean } };
    expect(body.data.read).toBe(true);
  });

  it("returns 200 for mark-all-read", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/mark-all-read", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { updated: number } };
    expect(body.data.updated).toBe(5);
  });
});

describe("WhatsApp adapter (notifications utility)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "", json: async () => ({}) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendWhatsApp returns false and logs when Twilio env vars absent", async () => {
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({});
    const result = await ns.sendWhatsApp("+6281200000001", "HX123", { name: "John" });
    expect(result).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("sendWhatsApp sends POST to Twilio API when configured", async () => {
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({
      TWILIO_ACCOUNT_SID: "AC_test",
      TWILIO_AUTH_TOKEN: "test_token",
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
    });
    const result = await ns.sendWhatsApp("+6281200000001", "HX_template", { name: "John" });
    expect(result).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("twilio.com");
    expect(url).toContain("AC_test");
    expect((opts as RequestInit).method).toBe("POST");
  });

  it("sendWhatsApp returns false when Twilio API responds with error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    } as Response);
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({
      TWILIO_ACCOUNT_SID: "AC_test",
      TWILIO_AUTH_TOKEN: "test_token",
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
    });
    const result = await ns.sendWhatsApp("+6281200000001", "HX_template", {});
    expect(result).toBe(false);
  });

  it("sendWhatsApp returns false on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({
      TWILIO_ACCOUNT_SID: "AC_test",
      TWILIO_AUTH_TOKEN: "test_token",
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
    });
    const result = await ns.sendWhatsApp("+6281200000001", "HX_template", {});
    expect(result).toBe(false);
  });
});

describe("SMS adapter (notifications utility)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "", json: async () => ({}) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendSms returns false and logs when TWILIO_SMS_FROM absent", async () => {
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({});
    const result = await ns.sendSms("+6281200000001", "Your booking is confirmed");
    expect(result).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("sendSms sends POST to Twilio API when configured", async () => {
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({
      TWILIO_ACCOUNT_SID: "AC_test",
      TWILIO_AUTH_TOKEN: "test_token",
      TWILIO_SMS_FROM: "+14155238886",
    });
    const result = await ns.sendSms("+6281200000001", "Your booking is confirmed");
    expect(result).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("twilio.com");
    expect(url).toContain("AC_test");
    expect((opts as RequestInit).method).toBe("POST");
    const body = (opts as RequestInit).body as string;
    expect(body).toContain("Body=");
    expect(body).not.toContain("whatsapp");
  });

  it("sendSms returns false when Twilio API responds with error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    } as Response);
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({
      TWILIO_ACCOUNT_SID: "AC_test",
      TWILIO_AUTH_TOKEN: "test_token",
      TWILIO_SMS_FROM: "+14155238886",
    });
    const result = await ns.sendSms("+6281200000001", "Hello");
    expect(result).toBe(false);
  });

  it("sendSms returns false on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));
    const { createNotificationService } = await import("../../utils/notifications");
    const ns = createNotificationService({
      TWILIO_ACCOUNT_SID: "AC_test",
      TWILIO_AUTH_TOKEN: "test_token",
      TWILIO_SMS_FROM: "+14155238886",
    });
    const result = await ns.sendSms("+6281200000001", "Hello");
    expect(result).toBe(false);
  });
});

describe("Channel config and preferences HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = createMockDb();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /channels returns 401 without auth", async () => {
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/channels", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("GET /channels returns 403 without ORG_SETTINGS read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/channels", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("GET /channels returns 200 with channel configs", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ORG_SETTINGS", canRead: true, canUpdate: true },
    ]);
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.notificationChannelConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { notificationType: "BOOKING_CONFIRMED", pushEnabled: true, whatsappEnabled: false, smsEnabled: false },
    ]);
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/channels", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  it("PUT /channels/:type returns 403 without ORG_SETTINGS update", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ORG_SETTINGS", canRead: true, canUpdate: false },
    ]);
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/channels/BOOKING_CONFIRMED", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pushEnabled: true, whatsappEnabled: true, smsEnabled: false }),
    });
    expect(res.status).toBe(403);
  });

  it("PUT /channels/:type returns 200 and upserts config", async () => {
    mockTenantRolePermissions(db, [
      { featureCode: "ORG_SETTINGS", canRead: true, canUpdate: true },
    ]);
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    (db.notificationChannelConfig.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      notificationType: "BOOKING_CONFIRMED",
      pushEnabled: true,
      whatsappEnabled: true,
      smsEnabled: true,
    });
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/channels/BOOKING_CONFIRMED", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pushEnabled: true, whatsappEnabled: true, smsEnabled: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { whatsappEnabled: boolean; smsEnabled: boolean } };
    expect(body.data.whatsappEnabled).toBe(true);
    expect(body.data.smsEnabled).toBe(true);
  });

  it("GET /preferences returns 401 without auth", async () => {
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/preferences", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("GET /preferences returns 200 with user preferences", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.notificationPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      pushOptOut: false,
      whatsappOptOut: false,
      smsOptOut: false,
    });
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/preferences", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { pushOptOut: boolean; whatsappOptOut: boolean; smsOptOut: boolean } };
    expect(body.data.pushOptOut).toBe(false);
    expect(body.data.smsOptOut).toBe(false);
  });

  it("PUT /preferences returns 200 with updated preferences", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    (db.notificationPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      pushOptOut: false,
      whatsappOptOut: true,
      smsOptOut: false,
    });
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/preferences", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pushOptOut: false, whatsappOptOut: true, smsOptOut: false }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { whatsappOptOut: boolean; smsOptOut: boolean } };
    expect(body.data.whatsappOptOut).toBe(true);
    expect(body.data.smsOptOut).toBe(false);
  });
});

describe("notifications admin schema", () => {
  it("adminListQuery defaults page=1 limit=20", () => {
    const parsed = adminListQuery.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("adminListQuery rejects limit > 100", () => {
    expect(adminListQuery.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("testSendBody requires userId, title, body", () => {
    expect(testSendBody.safeParse({}).success).toBe(false);
    expect(
      testSendBody.safeParse({ userId: "u1", title: "t", body: "b" }).success,
    ).toBe(true);
  });

  it("testSendBody defaults type to TEST", () => {
    const parsed = testSendBody.parse({ userId: "u1", title: "t", body: "b" });
    expect(parsed.type).toBe("TEST");
  });
});

describe("notifications admin HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    invalidateAllPermissionCaches();
    db = createMockDb();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 for admin list without auth", async () => {
    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/admin", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for admin list without CAMPAIGNS read permission", async () => {
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    mockTenantRolePermissions(db, []);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/admin", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with org-wide notification list for admin", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    mockTenantRolePermissions(db, [
      { featureCode: "CAMPAIGNS", canRead: true },
    ]);
    const mockNotifs = [
      {
        id: "n1",
        userId: "u1",
        title: "Test",
        body: "Body",
        type: "BOOKING_CONFIRMED",
        data: null,
        read: false,
        createdAt: new Date(),
        user: { id: "u1", firstName: "John", lastName: "Doe", email: "j@e.com" },
      },
    ];
    (db.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotifs);
    (db.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/admin", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { user: { firstName: string } }[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].user.firstName).toBe("John");
    expect(body.pagination.total).toBe(1);
  });

  it("returns 200 with notification stats for admin", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    mockTenantRolePermissions(db, [
      { featureCode: "CAMPAIGNS", canRead: true },
    ]);
    (db.notification.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(40);
    (db.notification.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { type: "BOOKING_CONFIRMED", _count: { type: 60 } },
      { type: "QUEUE_CALLED", _count: { type: 40 } },
    ]);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/admin/stats", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { totalSent: number; totalUnread: number; last30Days: number; byType: unknown[] } };
    expect(body.data.totalSent).toBe(100);
    expect(body.data.totalUnread).toBe(25);
    expect(body.data.last30Days).toBe(40);
    expect(body.data.byType).toHaveLength(2);
  });

  it("returns 404 for test-send to non-existent user", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    mockTenantRolePermissions(db, [
      { featureCode: "CAMPAIGNS", canRead: true },
    ]);
    (db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/admin/test-send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "u999", title: "Test", body: "Hello" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 200 for successful test-send", async () => {
    const token = await signTestJwt({
      sub: testUsers.superAdmin.userId,
      organizationId: testUsers.superAdmin.organizationId,
      tenantRoleId: testUsers.superAdmin.tenantRoleId,
      scope: testUsers.superAdmin.scope,
    });
    mockTenantRolePermissions(db, [
      { featureCode: "CAMPAIGNS", canRead: true },
    ]);
    (db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u1",
      organizationId: "org-1",
    });
    (db.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "notif-1",
    });

    const app = mountFeatureWithDb(notificationsApp, db);
    const res = await app.request("http://t/admin/test-send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "u1", title: "Test", body: "Hello" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { notificationId: string } };
    expect(body.data.notificationId).toBe("notif-1");
  });
});
