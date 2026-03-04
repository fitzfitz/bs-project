import type { PrismaClient, Prisma } from "@prisma/client";
import type { QueueStatus, QueueSource, DayOfWeek } from "@prisma/client";
import { HTTPException } from "hono/http-exception";
import type { CloudflarePusher } from "../../utils/pusher";
import type {
  CreateBookingInput,
  UpdateQueueStatusInput,
  AssignStaffToQueueInput,
} from "./queue.schema";
import type { StaffTier } from "@prisma/client";
import { TransactionService } from "../transactions/transactions.service";

export const QueueService = {
  // --- View Queue ---

  async listQueue(
    db: PrismaClient,
    filters: {
      branchId: string;
      date?: string;
      staffProfileId?: string;
      status?: string;
    }
  ) {
    const where: Prisma.QueueEntryWhereInput = {
      branchId: filters.branchId,
      ...(filters.staffProfileId && { staffProfileId: filters.staffProfileId }),
      ...(filters.status && { status: filters.status as QueueStatus }),
    };

    if (filters.date) {
      const gte = new Date(filters.date);
      const lte = new Date(filters.date);
      lte.setDate(lte.getDate() + 1);
      where.createdAt = { gte, lt: lte };
    }

    return await db.queueEntry.findMany({
      where,
      orderBy: { position: "asc" },
      include: {
        staff: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        booking: {
          select: {
            id: true,
            scheduledAt: true,
            note: true,
            totalDuration: true,
            items: {
              select: {
                service: {
                  select: { name: true, durationMinutes: true, basePrice: true },
                },
              },
            },
          },
        },
      },
    });
  },

  async getEntryById(db: PrismaClient, id: string) {
    return await db.queueEntry.findUnique({
      where: { id },
      include: {
        staff: { include: { user: true } },
        booking: {
          include: {
            items: { include: { service: true } },
          },
        },
      },
    });
  },

  async getUserEntries(db: PrismaClient, userId: string) {
    return await db.queueEntry.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        branch: true,
        staff: { include: { user: true } },
        booking: {
          include: {
            items: { include: { service: true } },
          },
        },
        transaction: true,
      },
    });
  },

  // --- Operations ---

  async createEntry(db: PrismaClient, data: CreateBookingInput, organizationId: string, pusher?: CloudflarePusher) {
    const branch = await db.branch.findUnique({ where: { id: data.branchId }, select: { isEmergencyClosed: true } });
    if (branch?.isEmergencyClosed) {
      throw new HTTPException(403, { message: "Branch is temporarily closed due to an emergency" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Resolve services with overrides and surcharges
    const services = await db.service.findMany({
      where: { id: { in: data.serviceIds } },
      include: {
        branchOverrides: { where: { branchId: data.branchId } },
        tierSurcharges: true,
      },
    });

    const hasCombo = services.some((s) => s.type === "COMBO");
    const totalDuration = hasCombo
      ? services.reduce((acc, s) => acc + s.durationMinutes, 0) +
        Math.max(...services.map((s) => s.bufferMinutes))
      : services.reduce((acc, s) => acc + s.durationMinutes + s.bufferMinutes, 0);

    const staffTier = data.staffProfileId
      ? (await db.staffProfile.findUnique({ where: { id: data.staffProfileId } }))?.tier
      : null;

    const DAYS: Array<"SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY"> = [
      "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
    ];
    const slotDate = new Date(data.startTime);
    const hourWIB = (slotDate.getUTCHours() + 7) % 24;
    const dayOffset = slotDate.getUTCHours() + 7 >= 24 ? 1 : 0;
    const dayOfWeekWIB = DAYS[(slotDate.getUTCDay() + dayOffset) % 7] as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

    const surgeRules = await db.surgeRule.findMany({
      where: { branchId: data.branchId, isActive: true },
    });
    const matchingSurge = surgeRules.find(
      (r) => r.dayOfWeek === dayOfWeekWIB && hourWIB >= r.startHour && hourWIB < r.endHour
    );
    const surgeMultiplier = matchingSurge?.multiplier ?? 1;

    const bookingItems = services.map((service) => {
      const override = service.branchOverrides.find((o) => o.isActive);
      let price = override?.overridePrice ?? service.basePrice;

      if (staffTier) {
        const surcharge = service.tierSurcharges.find((ts) => ts.tier === staffTier);
        if (surcharge) price += surcharge.surcharge;
      }

      price = Math.round(price * surgeMultiplier);

      return {
        serviceId: service.id,
        price,
        isAddOn: service.type === "ADD_ON",
      };
    });

    const result = await db.$transaction(async (tx) => {
      if (data.staffProfileId) {
        const slotStart = new Date(data.startTime);
        const slotEnd = new Date(slotStart.getTime() + totalDuration * 60 * 1000);
        const existing = await tx.queueEntry.findMany({
          where: {
            staffProfileId: data.staffProfileId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            bookingId: { not: null },
          },
          include: { booking: true },
        });
        for (const e of existing) {
          if (!e.booking) continue;
          
          // Allow back-to-back bookings by making overlap strict > instead of >=
          // Start a: slotStart, End a: slotEnd
          // Start b: otherStart, End b: otherEnd
          // Overlap condition: a.start < b.end AND a.end > b.start
          const otherStart = e.booking.scheduledAt;
          const otherEnd = new Date(otherStart.getTime() + e.booking.totalDuration * 60 * 1000);
          
          if (slotStart < otherEnd && slotEnd > otherStart) {
            throw new HTTPException(409, { message: "Time slot already booked" });
          }
        }
      }

      let customerId = data.customerId;

      // Auto-create dummy customer if walk-in without account
      if (!customerId) {
        const customerRole = await tx.tenantRole.findFirst({
          where: { organizationId, scope: "CUSTOMER", isDefault: true },
        });
        if (!customerRole) throw new HTTPException(500, { message: "No default customer role configured" });
        const guestUser = await tx.user.create({
          data: {
            organizationId,
            tenantRoleId: customerRole.id,
            email: `walkin-${Date.now()}@example.com`,
            passwordHash: "",
            firstName: data.customerName || "Guest",
            lastName: "",
            phone: data.customerPhone || null,
          },
        });
        customerId = guestUser.id;
      }

      const booking = await tx.booking.create({
        data: {
          organizationId,
          customerId: customerId,
          branchId: data.branchId,
          staffProfileId: data.staffProfileId ?? null,
          status: "CONFIRMED",
          scheduledAt: new Date(data.startTime),
          totalDuration,
          note: data.notes ?? null,
          items: {
            create: bookingItems.map((item) => ({ ...item, organizationId })),
          },
        },
      });

      const count = await tx.queueEntry.count({
        where: {
          branchId: data.branchId,
          createdAt: { gte: today },
        },
      });

      const entry = await tx.queueEntry.create({
        data: {
          organizationId,
          branchId: data.branchId,
          customerId: customerId,
          customerName: data.customerName ?? undefined,
          status: "WAITING",
          source: data.source as QueueSource,
          position: count + 1,
          staffProfileId: data.staffProfileId ?? undefined,
          bookingId: booking.id,
          estimatedWait: totalDuration,
        },
      });

      return entry;
    });

    if (pusher) {
      try {
        void pusher.trigger(`branch-${result.branchId}`, "QUEUE_UPDATED", result).catch((e: any) => console.error("Pusher promise error:", e.message));
      } catch (e: any) {
        console.error("Pusher sync error:", e.message);
      }
    }
    return result;
  },

  async updateStatus(
    db: PrismaClient,
    id: string,
    data: UpdateQueueStatusInput,
    organizationId: string,
    pusher?: CloudflarePusher
  ) {
    let updateData: Prisma.QueueEntryUpdateInput = {
      status: data.status as QueueStatus,
    };

    if (data.status === "CALLED") {
      updateData.calledAt = new Date();
    } else if (data.status === "IN_SERVICE") {
      updateData.startedAt = new Date();
    } else if (data.status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    const entry = await db.queueEntry.update({
      where: { id },
      data: updateData,
    });
    
    // Auto-create draft transaction when transitioning to AT_CHECKOUT
    if (data.status === "AT_CHECKOUT") {
      const fullEntry = await db.queueEntry.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              items: {
                include: { service: true },
              },
            },
          },
        },
      });

      if (fullEntry) {
        const items = fullEntry.booking?.items.map((bi) => ({
          serviceId: bi.serviceId,
          name: bi.service?.name || "Unknown Service",
          quantity: 1,
          unitPrice: bi.price,
          discount: 0,
          isAddOn: bi.isAddOn,
        })) || [];

        try {
          await TransactionService.createTransaction(db, {
            branchId: fullEntry.branchId,
            queueEntryId: fullEntry.id,
            staffProfileId: fullEntry.staffProfileId || undefined,
            customerId: fullEntry.customerId || undefined,
            items,
            tipAmount: 0,
            discountAmount: 0,
            loyaltyPointsUsed: 0,
          }, organizationId);
        } catch (error: any) {
          console.error("Failed to auto-draft transaction:", error.message);
        }
      }
    }

    if (pusher) void pusher.trigger(`branch-${entry.branchId}`, "QUEUE_UPDATED", entry);
    return entry;
  },

  async assignStaff(
    db: PrismaClient,
    id: string,
    data: AssignStaffToQueueInput,
    pusher?: CloudflarePusher
  ) {
    const entry = await db.queueEntry.update({
      where: { id },
      data: { staffProfileId: data.staffProfileId },
    });
    
    if (pusher) void pusher.trigger(`branch-${entry.branchId}`, "QUEUE_UPDATED", entry);
    return entry;
  },

  async postponeEntry(db: PrismaClient, id: string, minutes: number, pusher?: CloudflarePusher) {
    const entry = await db.queueEntry.findUnique({ where: { id } });
    if (!entry) throw new Error("Entry not found");

    const updated = await db.queueEntry.update({
      where: { id },
      data: {
        estimatedWait: (entry.estimatedWait ?? 0) + minutes,
      },
    });
    
    if (pusher) void pusher.trigger(`branch-${updated.branchId}`, "QUEUE_UPDATED", updated);
    return updated;
  },

  async cancelEntry(db: PrismaClient, id: string, pusher?: CloudflarePusher) {
    const entry = await db.queueEntry.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    
    if (pusher) void pusher.trigger(`branch-${entry.branchId}`, "QUEUE_UPDATED", entry);
    return entry;
  },

  async customerCancelEntry(
    db: PrismaClient,
    entryId: string,
    userId: string,
    pusher?: CloudflarePusher
  ) {
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      include: { booking: true },
    });

    if (!entry) throw new HTTPException(404, { message: "Entry not found" });
    if (entry.customerId !== userId) {
      throw new HTTPException(403, { message: "You can only cancel your own bookings" });
    }
    if (!["WAITING", "CALLED"].includes(entry.status)) {
      throw new HTTPException(400, { message: "Only WAITING or CALLED entries can be cancelled" });
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedEntry = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: "CANCELLED" },
      });

      if (entry.bookingId) {
        await tx.booking.update({
          where: { id: entry.bookingId },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
      }

      return updatedEntry;
    });

    if (pusher) void pusher.trigger(`branch-${updated.branchId}`, "QUEUE_UPDATED", updated);
    return updated;
  },

  async rescheduleEntry(
    db: PrismaClient,
    entryId: string,
    userId: string,
    newStartTime: string,
    pusher?: CloudflarePusher
  ) {
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      include: { booking: true },
    });

    if (!entry) throw new HTTPException(404, { message: "Entry not found" });
    if (entry.customerId !== userId) {
      throw new HTTPException(403, { message: "You can only reschedule your own bookings" });
    }
    if (!["WAITING", "CALLED"].includes(entry.status)) {
      throw new HTTPException(400, { message: "Only WAITING or CALLED entries can be rescheduled" });
    }
    if (!entry.booking) {
      throw new HTTPException(400, { message: "Walk-in entries cannot be rescheduled" });
    }

    const slotStart = new Date(newStartTime);
    const slotEnd = new Date(slotStart.getTime() + entry.booking.totalDuration * 60 * 1000);

    if (entry.staffProfileId) {
      const existing = await db.queueEntry.findMany({
        where: {
          staffProfileId: entry.staffProfileId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          bookingId: { not: null },
          id: { not: entryId },
        },
        include: { booking: true },
      });

      for (const e of existing) {
        if (!e.booking) continue;
        const otherStart = e.booking.scheduledAt;
        const otherEnd = new Date(otherStart.getTime() + e.booking.totalDuration * 60 * 1000);
        if (slotStart < otherEnd && slotEnd > otherStart) {
          throw new HTTPException(409, { message: "Time slot already booked" });
        }
      }
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: entry.booking!.id },
        data: { scheduledAt: slotStart },
      });

      const updatedEntry = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: "WAITING" },
        include: {
          booking: { include: { items: { include: { service: true } } } },
          branch: true,
          staff: { include: { user: true } },
        },
      });

      return updatedEntry;
    });

    if (pusher) void pusher.trigger(`branch-${updated.branchId}`, "QUEUE_UPDATED", updated);
    return updated;
  },

  async getAvailableSlots(
    db: PrismaClient,
    branchId: string,
    dateStr: string,
    staffProfileId?: string,
  ): Promise<{ time: string; available: boolean }[]> {
    const branchData = await db.branch.findUnique({
      where: { id: branchId },
      select: { isEmergencyClosed: true },
    });
    if (branchData?.isEmergencyClosed) return [];

    const slotDate = new Date(dateStr);

    const holiday = await db.branchHoliday.findUnique({
      where: { branchId_date: { branchId, date: slotDate } },
    });
    if (holiday?.isClosed) return [];

    const dayOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][
      slotDate.getDay()
    ];

    const hours = await db.operatingHour.findMany({
      where: { branchId, dayOfWeek: dayOfWeek as DayOfWeek },
    });

    if (hours.length === 0 || hours.every((h) => h.isClosed)) {
      return [];
    }

    const oh = hours[0];
    const openMinutes = holiday?.openTime ? parseTime(holiday.openTime) : parseTime(oh.openTime);
    const closeMinutes = holiday?.closeTime ? parseTime(holiday.closeTime) : parseTime(oh.closeTime);
    const SLOT_DURATION = 30;

    const dateStart = new Date(dateStr);
    const dateEnd = new Date(dateStr);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const existingEntries = await db.queueEntry.findMany({
      where: {
        branchId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        createdAt: { gte: dateStart, lt: dateEnd },
        ...(staffProfileId ? { staffProfileId } : {}),
      },
      include: { booking: true },
    });

    const bookedTimes = new Set<number>();
    for (const e of existingEntries) {
      const scheduled = e.booking?.scheduledAt ?? e.createdAt;
      if (scheduled) {
        const d = new Date(scheduled);
        const m = d.getHours() * 60 + d.getMinutes();
        bookedTimes.add(m);
      }
    }

    const slots: { time: string; available: boolean }[] = [];
    for (let m = openMinutes; m + SLOT_DURATION <= closeMinutes; m += SLOT_DURATION) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push({
        time: `${hh}:${mm}`,
        available: !bookedTimes.has(m),
      });
    }

    return slots;
  },
};

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
