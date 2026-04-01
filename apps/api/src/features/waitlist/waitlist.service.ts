import type { PrismaClient } from "@prisma/client";
import { HTTPException } from "hono/http-exception";
import { ConfigService } from "../config/config.service";
import type { NotificationService } from "../../utils/notifications";
import type { JoinWaitlistInput } from "./waitlist.schema";

function dayBoundsUtc(ymd: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(`${ymd}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

/** WIB calendar date + 30-minute slot label aligned with queue availability. */
export function bookingScheduledAtToWaitlistKeys(scheduledAt: Date): {
  ymd: string;
  timeSlot: string;
} {
  const wibMs = scheduledAt.getTime() + 7 * 60 * 60 * 1000;
  const w = new Date(wibMs);
  const y = w.getUTCFullYear();
  const mo = String(w.getUTCMonth() + 1).padStart(2, "0");
  const d = String(w.getUTCDate()).padStart(2, "0");
  const ymd = `${y}-${mo}-${d}`;
  const mins = w.getUTCHours() * 60 + w.getUTCMinutes();
  const slotMins = Math.floor(mins / 30) * 30;
  const th = String(Math.floor(slotMins / 60)).padStart(2, "0");
  const tm = String(slotMins % 60).padStart(2, "0");
  return { ymd, timeSlot: `${th}:${tm}` };
}

function slotEndUtcFromYmdAndSlot(ymd: string, timeSlot: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = timeSlot.split(":").map(Number);
  const ms = Date.UTC(y, mo - 1, d, h - 7, mi, 0, 0);
  return new Date(ms + 30 * 60 * 1000);
}

export const WaitlistService = {
  async joinWaitlist(db: PrismaClient, organizationId: string, userId: string, data: JoinWaitlistInput) {
    const enabled = await ConfigService.getValue(db, "WAITLIST_ENABLED");
    if (enabled !== "true") {
      throw new HTTPException(400, { message: "Waitlist is not enabled" });
    }

    const branch = await db.branch.findFirst({
      where: { id: data.branchId, organizationId },
      select: { id: true },
    });
    if (!branch) {
      throw new HTTPException(404, { message: "Branch not found" });
    }

    const user = await db.user.findFirst({
      where: { id: userId, organizationId },
      select: { firstName: true, lastName: true },
    });
    if (!user) {
      throw new HTTPException(404, { message: "User not found" });
    }

    const maxPerSlot = await ConfigService.getNumericConfig(db, "WAITLIST_MAX_PER_SLOT", 5);
    const { dayStart, dayEnd } = dayBoundsUtc(data.preferredDate);

    const count = await db.waitlistEntry.count({
      where: {
        organizationId,
        branchId: data.branchId,
        preferredDate: { gte: dayStart, lt: dayEnd },
        preferredTimeSlot: data.preferredTimeSlot,
        status: { in: ["WAITING", "NOTIFIED"] },
      },
    });

    if (count >= maxPerSlot) {
      throw new HTTPException(400, { message: "Waitlist is full for this time slot" });
    }

    const customerName = `${user.firstName} ${user.lastName}`.trim();
    const expiresAt = slotEndUtcFromYmdAndSlot(data.preferredDate, data.preferredTimeSlot);

    return db.waitlistEntry.create({
      data: {
        organizationId,
        branchId: data.branchId,
        userId,
        customerName,
        preferredDate: dayStart,
        preferredTimeSlot: data.preferredTimeSlot,
        serviceIds: data.serviceIds,
        staffProfileId: data.staffProfileId ?? null,
        expiresAt,
      },
    });
  },

  async getMyWaitlist(db: PrismaClient, organizationId: string, userId: string) {
    const now = new Date();
    return db.waitlistEntry.findMany({
      where: {
        organizationId,
        userId,
        expiresAt: { gt: now },
        status: { in: ["WAITING", "NOTIFIED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async leaveWaitlist(db: PrismaClient, organizationId: string, userId: string, entryId: string) {
    const entry = await db.waitlistEntry.findFirst({
      where: { id: entryId, organizationId },
    });
    if (!entry) {
      throw new HTTPException(404, { message: "Waitlist entry not found" });
    }
    if (entry.userId !== userId) {
      throw new HTTPException(403, { message: "You can only remove your own waitlist entries" });
    }
    if (!["WAITING", "NOTIFIED"].includes(entry.status)) {
      throw new HTTPException(400, { message: "This waitlist entry cannot be cancelled" });
    }

    return db.waitlistEntry.update({
      where: { id: entryId },
      data: { status: "CANCELLED" },
    });
  },

  async getAdminWaitlist(db: PrismaClient, branchId: string) {
    return db.waitlistEntry.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  },

  async notifyNextWaitlisted(
    db: PrismaClient,
    organizationId: string,
    branchId: string,
    bookingScheduledAt: Date,
    notificationService?: NotificationService,
  ): Promise<void> {
    const { ymd, timeSlot } = bookingScheduledAtToWaitlistKeys(bookingScheduledAt);
    const { dayStart, dayEnd } = dayBoundsUtc(ymd);

    const next = await db.waitlistEntry.findFirst({
      where: {
        organizationId,
        branchId,
        preferredDate: { gte: dayStart, lt: dayEnd },
        preferredTimeSlot: timeSlot,
        status: "WAITING",
      },
      orderBy: { createdAt: "asc" },
      include: { branch: { select: { name: true } } },
    });

    if (!next) return;

    const branchName = next.branch?.name ?? "the branch";
    const title = "A slot opened up";
    const body = `A booking at ${branchName} was cancelled — you may be able to book this time. Open the app to claim your spot.`;
    const notifData: Record<string, string> = {
      type: "WAITLIST_SLOT_OPEN",
      waitlistEntryId: next.id,
      branchId: next.branchId,
    };

    await db.waitlistEntry.update({
      where: { id: next.id },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });

    if (notificationService) {
      notificationService
        .sendPush(next.userId, title, body, notifData)
        .catch((e: { message?: string }) =>
          console.error("[waitlist] notify push failed:", e.message),
        );
    }

    await db.notification
      .create({
        data: {
          organizationId,
          userId: next.userId,
          title,
          body,
          type: "WAITLIST_SLOT_OPEN",
          data: notifData,
        },
      })
      .catch((e: { message?: string }) =>
        console.error("[waitlist] notification record failed:", e.message),
      );
  },

  async expireWaitlistEntries(db: PrismaClient): Promise<number> {
    const now = new Date();
    const result = await db.waitlistEntry.updateMany({
      where: {
        status: { in: ["WAITING", "NOTIFIED"] },
        expiresAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    });
    return result.count;
  },
};
