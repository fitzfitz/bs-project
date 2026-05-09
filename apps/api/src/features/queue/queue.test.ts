import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createBookingSchema,
  listQueueQuery,
  updateQueueStatusSchema,
  rescheduleSchema,
} from "./queue.schema";
import { QueueService } from "./queue.service";
import queueApp from "./queue.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
  getTestBindings,
} from "../../test/helpers";

vi.mock("../../utils/xendit-adapter", () => ({
  createXenditInvoice: vi.fn().mockResolvedValue({
    id: "xendit-inv-test",
    invoice_url: "https://checkout.xendit.co/test",
  }),
}));
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";
import { ConfigService } from "../config/config.service";
import type { NotificationService } from "../../utils/notifications";

describe("queue.schema", () => {
  it("rejects createBooking without customerName", () => {
    const r = createBookingSchema.safeParse({
      customerName: "",
      branchId: "b1",
      serviceIds: ["s1"],
      startTime: new Date().toISOString(),
      estimatedDuration: 30,
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid createBooking", () => {
    const r = createBookingSchema.safeParse({
      customerName: "Walk-in",
      branchId: "b1",
      serviceIds: ["s1"],
      startTime: new Date().toISOString(),
      estimatedDuration: 30,
    });
    expect(r.success).toBe(true);
  });

  it("listQueueQuery requires branchId", () => {
    expect(listQueueQuery.safeParse({}).success).toBe(false);
    expect(listQueueQuery.safeParse({ branchId: "b1" }).success).toBe(true);
  });

  it("validates date format when provided", () => {
    expect(listQueueQuery.safeParse({ branchId: "b1", date: "bad" }).success).toBe(false);
    expect(listQueueQuery.safeParse({ branchId: "b1", date: "2025-03-01" }).success).toBe(true);
  });

  it("rescheduleSchema requires datetime startTime", () => {
    expect(rescheduleSchema.safeParse({ startTime: "not-a-date" }).success).toBe(false);
    expect(rescheduleSchema.safeParse({ startTime: new Date().toISOString() }).success).toBe(true);
  });

  it("updateQueueStatusSchema accepts enum status", () => {
    expect(updateQueueStatusSchema.safeParse({ status: "WAITING" }).success).toBe(true);
    expect(updateQueueStatusSchema.safeParse({ status: "INVALID" }).success).toBe(false);
  });
});

describe("QueueService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    ConfigService.clearCache();
  });

  it("listQueue builds filter and orders by position", async () => {
    const findMany = db.queueEntry.findMany as ReturnType<typeof vi.fn>;
    findMany.mockResolvedValue([]);
    await QueueService.listQueue(db, { branchId: "b1", date: "2025-01-15" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: "b1" }),
        orderBy: { position: "asc" },
      }),
    );
  });

  it("getEntryById delegates to prisma", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValue({ id: "q1" });
    const row = await QueueService.getEntryById(db, "q1");
    expect(row).toEqual({ id: "q1" });
  });

  it("createEntry rejects emergency-closed branch", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isEmergencyClosed: true,
    });
    await expect(
      QueueService.createEntry(
        db,
        {
          customerName: "A",
          branchId: "b1",
          serviceIds: ["s1"],
          startTime: new Date().toISOString(),
          estimatedDuration: 30,
          source: "WALK_IN",
        },
        "org-1",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("customerCancelEntry returns 404 when missing", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(QueueService.customerCancelEntry(db, "missing", "u1")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("customerCancelEntry returns 403 for wrong customer", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      customerId: "u-other",
      status: "WAITING",
      booking: null,
      bookingId: null,
    });
    await expect(QueueService.customerCancelEntry(db, "q1", "u1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("customerCancelEntry returns 400 when status not cancellable", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      customerId: "u1",
      status: "IN_SERVICE",
      booking: null,
      bookingId: null,
    });
    await expect(QueueService.customerCancelEntry(db, "q1", "u1")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("getAvailableSlots returns [] when branch emergency closed", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ isEmergencyClosed: true });
    const slots = await QueueService.getAvailableSlots(db, "b1", "2025-06-01");
    expect(slots).toEqual([]);
  });

  it("createEntry happy path creates booking and queue entry", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isEmergencyClosed: false,
      name: "Main Branch",
    });
    (db.service.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "s1",
        type: "REGULAR",
        basePrice: 50000,
        durationMinutes: 30,
        bufferMinutes: 5,
        branchOverrides: [],
        tierSurcharges: [],
      },
    ]);
    (db.surgeRule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => fn(db));
    (db.queueEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    const bookingCreate = db.booking.create as ReturnType<typeof vi.fn>;
    bookingCreate.mockResolvedValue({ id: "bk-new" });
    const queueCreate = db.queueEntry.create as ReturnType<typeof vi.fn>;
    queueCreate.mockResolvedValue({ id: "qe-new", branchId: "b1", bookingId: "bk-new" });

    const result = await QueueService.createEntry(
      db,
      {
        customerName: "Ada",
        customerId: "u1",
        branchId: "b1",
        serviceIds: ["s1"],
        startTime: new Date("2025-06-01T02:00:00.000Z").toISOString(),
        estimatedDuration: 30,
        source: "APP",
      },
      "org-1",
    );

    expect(bookingCreate).toHaveBeenCalled();
    expect(queueCreate).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "qe-new", bookingId: "bk-new" });
  });

  it("createEntry rejects with 409 when staff time slot overlaps", async () => {
    const slotStart = new Date("2025-06-01T10:00:00.000Z");
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isEmergencyClosed: false,
      name: "Main Branch",
    });
    (db.service.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "s1",
        type: "REGULAR",
        basePrice: 50000,
        durationMinutes: 30,
        bufferMinutes: 5,
        branchOverrides: [],
        tierSurcharges: [],
      },
    ]);
    (db.staffProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: "SENIOR" });
    (db.surgeRule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => fn(db));
    (db.queueEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        booking: {
          scheduledAt: slotStart,
          totalDuration: 30,
        },
      },
    ]);

    await expect(
      QueueService.createEntry(
        db,
        {
          customerName: "Bob",
          customerId: "u1",
          branchId: "b1",
          serviceIds: ["s1"],
          staffProfileId: "staff-1",
          startTime: slotStart.toISOString(),
          estimatedDuration: 30,
          source: "APP",
        },
        "org-1",
      ),
    ).rejects.toMatchObject({ status: 409, message: "Time slot already booked" });
  });

  it("updateStatus CALLED sets calledAt timestamp", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "WAITING",
      prepaidAmount: "100",
    });
    const update = db.queueEntry.update as ReturnType<typeof vi.fn>;
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "q1",
      branchId: "b1",
      customerId: null,
      status: "CALLED",
      ...data,
    }));
    await QueueService.updateStatus(db, "q1", { status: "CALLED" }, "org-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CALLED",
          calledAt: expect.any(Date),
        }),
      }),
    );
  });

  it("updateStatus IN_SERVICE sets startedAt timestamp", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "CALLED",
    });
    const update = db.queueEntry.update as ReturnType<typeof vi.fn>;
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "q1",
      branchId: "b1",
      customerId: null,
      status: "IN_SERVICE",
      ...data,
    }));
    await QueueService.updateStatus(db, "q1", { status: "IN_SERVICE" }, "org-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_SERVICE",
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("updateStatus COMPLETED sets completedAt timestamp", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "IN_SERVICE",
    });
    const update = db.queueEntry.update as ReturnType<typeof vi.fn>;
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "q1",
      branchId: "b1",
      customerId: null,
      status: "COMPLETED",
      ...data,
    }));
    await QueueService.updateStatus(db, "q1", { status: "COMPLETED" }, "org-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("assignStaff updates staffProfileId on entry", async () => {
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      branchId: "b1",
      staffProfileId: "sp-new",
    });
    await QueueService.assignStaff(db, "q1", { staffProfileId: "sp-new" });
    expect(db.queueEntry.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { staffProfileId: "sp-new" },
    });
  });

  it("postponeEntry adds minutes to estimatedWait", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      estimatedWait: 30,
    });
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      estimatedWait: 45,
      branchId: "b1",
    });
    const out = await QueueService.postponeEntry(db, "q1", 15);
    expect(out.estimatedWait).toBe(45);
    expect(db.queueEntry.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { estimatedWait: 45 },
    });
  });

  it("postponeEntry throws when entry not found", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(QueueService.postponeEntry(db, "missing", 10)).rejects.toThrow("Entry not found");
  });

  it("cancelEntry sets status CANCELLED", async () => {
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      status: "CANCELLED",
      branchId: "b1",
    });
    const result = await QueueService.cancelEntry(db, "q1");
    expect(result.status).toBe("CANCELLED");
    expect(db.queueEntry.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { status: "CANCELLED" },
    });
  });

  it("customerCancelEntry success cancels queue entry and booking", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      customerId: "u1",
      status: "WAITING",
      bookingId: "bk-1",
      organizationId: "org-1",
      branchId: "b1",
      booking: {
        id: "bk-1",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => fn(db));
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      status: "CANCELLED",
      branchId: "b1",
    });
    const bookingUpdate = db.booking.update as ReturnType<typeof vi.fn>;
    bookingUpdate.mockResolvedValue({ id: "bk-1" });
    (db.waitlistEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });

    await QueueService.customerCancelEntry(db, "q1", "u1");

    expect(bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bk-1" },
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });

  it("customerCancelEntry applies penalty when inside policy window with prepaid", async () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      customerId: "u1",
      status: "WAITING",
      bookingId: "bk-1",
      organizationId: "org-1",
      branchId: "b1",
      prepaidAmount: { toString: () => "100000" },
      booking: { id: "bk-1", scheduledAt: future },
    });
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where: { key } }: { where: { key: string } }) => {
        if (key === "CANCELLATION_POLICY_HOURS") return Promise.resolve({ value: "24" });
        if (key === "CANCELLATION_PENALTY_PERCENTAGE") return Promise.resolve({ value: "50" });
        return Promise.resolve(null);
      },
    );
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => fn(db));
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }: { data: { refundAmount?: number } }) => ({
      id: "q1",
      status: "CANCELLED",
      branchId: "b1",
      ...data,
    }));
    (db.booking.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });
    (db.waitlistEntry.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await QueueService.customerCancelEntry(db, "q1", "u1");

    expect(db.queueEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          refundAmount: 50000,
        }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it("prepayEntry returns invoice details when enabled", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      organizationId: "org-1",
      customerId: "u1",
      status: "WAITING",
      booking: {
        items: [{ price: 80000 }, { price: 20000 }],
      },
    });
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where: { key } }: { where: { key: string } }) => {
        if (key === "PREPAYMENT_ENABLED") return Promise.resolve({ value: "true" });
        if (key === "DEPOSIT_PERCENTAGE") return Promise.resolve({ value: "50" });
        return Promise.resolve(null);
      },
    );
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "q1" });

    const out = await QueueService.prepayEntry(db, "q1", "u1", "org-1", {
      successRedirectUrl: "https://ok.example/s",
      failureRedirectUrl: "https://ok.example/f",
      secretKey: "xnd_test",
    });

    expect(out.amount).toBe(50000);
    expect(out.invoiceId).toBe("xendit-inv-test");
    expect(db.queueEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { prepaymentReference: "xendit-inv-test" },
      }),
    );
  });

  it("rescheduleEntry returns 400 for walk-in without booking", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      customerId: "u1",
      status: "WAITING",
      booking: null,
    });
    await expect(
      QueueService.rescheduleEntry(db, "q1", "u1", new Date().toISOString()),
    ).rejects.toMatchObject({
      status: 400,
      message: "Walk-in entries cannot be rescheduled",
    });
  });

  it("getAvailableSlots returns empty array when holiday closed", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ isEmergencyClosed: false });
    (db.branchHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ isClosed: true });
    const slots = await QueueService.getAvailableSlots(db, "b1", "2025-06-15");
    expect(slots).toEqual([]);
  });

  it("getUserEntries returns entries for userId", async () => {
    const rows = [{ id: "qe-1", customerId: "u-cust" }];
    (db.queueEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows);
    const result = await QueueService.getUserEntries(db, "u-cust");
    expect(result).toEqual(rows);
    expect(db.queueEntry.findMany as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: "u-cust" },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});

describe("QueueService push notifications", () => {
  let db: ReturnType<typeof createMockDb>;
  let mockNotificationService: NotificationService & { sendPush: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    db = createMockDb();
    ConfigService.clearCache();
    (db.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "notif-1" });
    mockNotificationService = {
      sendPush: vi.fn<(userId: string, title: string, body: string, data?: Record<string, string>) => Promise<boolean>>().mockResolvedValue(true),
      sendWhatsApp: vi.fn<(phone: string, templateId: string, vars?: Record<string, string>) => Promise<boolean>>().mockResolvedValue(false),
      sendSms: vi.fn<(phone: string, body: string) => Promise<boolean>>().mockResolvedValue(false),
    };
  });

  it("sends booking confirmed push after createEntry", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isEmergencyClosed: false,
      name: "Main Branch",
    });
    (db.service.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "s1",
        type: "REGULAR",
        basePrice: 50000,
        durationMinutes: 30,
        bufferMinutes: 5,
        branchOverrides: [],
        tierSurcharges: [],
      },
    ]);
    (db.surgeRule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.queueEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const mockEntry = {
      id: "qe-1",
      branchId: "b1",
      customerId: "user-customer",
      status: "WAITING",
    };
    (db.booking.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "bk-1" });
    (db.queueEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntry);

    await QueueService.createEntry(
      db,
      {
        customerName: "John",
        customerId: "user-customer",
        branchId: "b1",
        serviceIds: ["s1"],
        startTime: new Date().toISOString(),
        estimatedDuration: 30,
        source: "APP",
      },
      "org-1",
      undefined,
      mockNotificationService,
    );

    expect(mockNotificationService.sendPush).toHaveBeenCalledWith(
      "user-customer",
      "Booking Confirmed",
      expect.stringContaining("confirmed"),
      expect.objectContaining({ type: "BOOKING_CONFIRMED" }),
    );
  });

  it("does not send push when notificationService is undefined", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isEmergencyClosed: false,
      name: "Main Branch",
    });
    (db.service.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "s1",
        type: "REGULAR",
        basePrice: 50000,
        durationMinutes: 30,
        bufferMinutes: 5,
        branchOverrides: [],
        tierSurcharges: [],
      },
    ]);
    (db.surgeRule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.queueEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.booking.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "bk-1" });
    (db.queueEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "qe-1",
      branchId: "b1",
      customerId: "user-customer",
      status: "WAITING",
    });

    await QueueService.createEntry(
      db,
      {
        customerName: "John",
        customerId: "user-customer",
        branchId: "b1",
        serviceIds: ["s1"],
        startTime: new Date().toISOString(),
        estimatedDuration: 30,
        source: "APP",
      },
      "org-1",
    );

    expect(mockNotificationService.sendPush).not.toHaveBeenCalled();
  });

  it("sends CALLED push on status transition to CALLED", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "WAITING",
    });
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      branchId: "b1",
      customerId: "user-customer",
      status: "CALLED",
    });
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Main Branch" });

    await QueueService.updateStatus(
      db,
      "q1",
      { status: "CALLED" },
      "org-1",
      undefined,
      mockNotificationService,
    );

    expect(mockNotificationService.sendPush).toHaveBeenCalledWith(
      "user-customer",
      "Your Turn Is Coming",
      expect.stringContaining("called"),
      expect.objectContaining({ type: "QUEUE_CALLED" }),
    );
  });

  it("sends COMPLETED push on status transition to COMPLETED", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "IN_SERVICE",
    });
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      branchId: "b1",
      customerId: "user-customer",
      status: "COMPLETED",
    });
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Main Branch" });

    await QueueService.updateStatus(
      db,
      "q1",
      { status: "COMPLETED" },
      "org-1",
      undefined,
      mockNotificationService,
    );

    expect(mockNotificationService.sendPush).toHaveBeenCalledWith(
      "user-customer",
      "Service Complete",
      expect.stringContaining("complete"),
      expect.objectContaining({ type: "QUEUE_COMPLETED" }),
    );
  });

  it("does not send push for non-notification statuses like IN_SERVICE", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "WAITING",
    });
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      branchId: "b1",
      customerId: "user-customer",
      status: "IN_SERVICE",
    });
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await QueueService.updateStatus(
      db,
      "q1",
      { status: "IN_SERVICE" },
      "org-1",
      undefined,
      mockNotificationService,
    );

    expect(mockNotificationService.sendPush).not.toHaveBeenCalled();
  });

  it("does not throw when push notification fails", async () => {
    const findUnique = db.queueEntry.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValueOnce({
      id: "q1",
      status: "WAITING",
    });
    mockNotificationService.sendPush.mockRejectedValue(new Error("OneSignal down"));
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      branchId: "b1",
      customerId: "user-customer",
      status: "CALLED",
    });
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Main Branch" });

    await expect(
      QueueService.updateStatus(
        db,
        "q1",
        { status: "CALLED" },
        "org-1",
        undefined,
        mockNotificationService,
      ),
    ).resolves.toBeDefined();
  });
});

describe("queue HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    ConfigService.clearCache();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "QUEUE_MANAGEMENT", canUpdate: true, canDelete: true },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when listing queue without Authorization", async () => {
    const app = mountFeatureWithDb(queueApp, db);
    const res = await app.request("http://t/?branchId=b1", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 200 when listing queue with valid JWT", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.queueEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const app = mountFeatureWithDb(queueApp, db);
    const res = await app.request("http://t/?branchId=b1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 404 when queue entry not found", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(queueApp, db);
    const res = await app.request("http://t/nope", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when updating status without QUEUE_MANAGEMENT", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(queueApp, db);
    const res = await app.request("http://t/q1/status", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "CALLED" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 when staff updates status with permission", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      status: "WAITING",
      prepaidAmount: "100",
    });
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      branchId: "b1",
      status: "CALLED",
    });
    const app = mountFeatureWithDb(queueApp, db);
    const res = await app.request("http://t/q1/status", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "CALLED" }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /availability is public", async () => {
    (db.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ isEmergencyClosed: false });
    (db.branchHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.operatingHour.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { openTime: "09:00", closeTime: "17:00", isClosed: false },
    ]);
    (db.queueEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const app = mountFeatureWithDb(queueApp, db);
    const res = await app.request(
      "http://t/availability?branchId=b1&date=2025-06-02",
      { method: "GET" },
    );
    expect(res.status).toBe(200);
  });

  it("POST /:id/prepay returns 200 for customer with Xendit configured", async () => {
    (db.queueEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
      organizationId: testUsers.customer.organizationId,
      customerId: testUsers.customer.userId,
      status: "WAITING",
      booking: {
        items: [{ price: 100000 }],
      },
    });
    (db.platformConfig.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where: { key } }: { where: { key: string } }) => {
        if (key === "PREPAYMENT_ENABLED") return Promise.resolve({ value: "true" });
        if (key === "DEPOSIT_PERCENTAGE") return Promise.resolve({ value: "100" });
        return Promise.resolve(null);
      },
    );
    (db.queueEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "q1" });

    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(queueApp, db, {
      ...getTestBindings(),
      XENDIT_SECRET_KEY: "xnd_test_key",
    });
    const res = await app.request("http://t/q1/prepay", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        successRedirectUrl: "https://example.com/ok",
        failureRedirectUrl: "https://example.com/fail",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { amount: number } };
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(100000);
  });
});
