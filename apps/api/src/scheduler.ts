import cron from "node-cron";
import { createHash, createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { DayOfWeek } from "@prisma/client";
import { getPrisma } from "./utils/db.js";
import { logger as rootLogger } from "./utils/logger.js";

const log = rootLogger.child({ module: "scheduler" });

const DAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

function getDb(): PrismaClient {
  return getPrisma(process.env.DATABASE_URL!);
}

async function triggerPusher(
  channel: string,
  event: string,
  data: unknown
): Promise<void> {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  if (!appId || !key || !secret) return;

  const cluster = process.env.PUSHER_CLUSTER ?? "mt1";
  const host = process.env.PUSHER_HOST || `api-${cluster}.pusher.com`;
  const port = process.env.PUSHER_PORT || "443";
  const scheme = process.env.PUSHER_USE_TLS !== "false" ? "https" : "http";

  const body = JSON.stringify({
    name: event,
    channels: [channel],
    data: typeof data === "string" ? data : JSON.stringify(data),
  });

  const bodyMd5 = createHash("md5").update(body).digest("hex");

  const method = "POST";
  const path = `/apps/${appId}/events`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const authQueryString = [
    `auth_key=${key}`,
    `auth_timestamp=${timestamp}`,
    `auth_version=1.0`,
    `body_md5=${bodyMd5}`,
  ].join("&");

  const stringToSign = [method, path, authQueryString].join("\n");
  const authSignature = createHmac("sha256", secret)
    .update(stringToSign)
    .digest("hex");

  const url = `${scheme}://${host}:${port}${path}?${authQueryString}&auth_signature=${authSignature}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      log.error({ status: res.status }, "Pusher trigger failed");
    }
  } catch (err: any) {
    log.error({ err }, "Pusher fetch error");
  }
}

// ─── Job 1: NO_SHOW Timeout ──────────────────────────────────────────────────
// Runs every minute. Transitions CALLED entries older than 5 minutes to NO_SHOW.

async function processNoShowTimeout(): Promise<void> {
  const db = getDb();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  try {
    const staleEntries = await db.queueEntry.findMany({
      where: {
        status: "CALLED",
        calledAt: { lt: fiveMinAgo },
      },
      select: { id: true, branchId: true },
    });

    if (staleEntries.length === 0) return;

    await db.queueEntry.updateMany({
      where: { id: { in: staleEntries.map((e) => e.id) } },
      data: { status: "NO_SHOW" },
    });

    const branchIds = [...new Set(staleEntries.map((e) => e.branchId))];
    for (const branchId of branchIds) {
      await triggerPusher(`branch-${branchId}`, "QUEUE_UPDATED", {
        type: "NO_SHOW_TIMEOUT",
        branchId,
      });
    }

    log.info({ count: staleEntries.length }, "NO_SHOW: transitioned entries");
  } catch (err: unknown) {
    log.error({ err }, "NO_SHOW job error");
  }
}

// ─── Job 1b: Grace Period Auto-Release ───────────────────────────────────────
// Runs every 5 minutes. Online bookings past their scheduled time + 10 min grace
// period are transitioned to NO_SHOW and the staff member is released.

async function processGracePeriodRelease(): Promise<void> {
  const db = getDb();
  const gracePeriodMs = 10 * 60 * 1000;
  const cutoff = new Date(Date.now() - gracePeriodMs);

  try {
    const lateEntries = await db.queueEntry.findMany({
      where: {
        source: { in: ["APP", "WEB"] },
        status: "WAITING",
        booking: {
          scheduledAt: { lt: cutoff },
        },
      },
      select: { id: true, branchId: true, staffProfileId: true, organizationId: true },
    });

    if (lateEntries.length === 0) return;

    await db.queueEntry.updateMany({
      where: { id: { in: lateEntries.map((e) => e.id) } },
      data: { status: "NO_SHOW" },
    });

    const staffProfileIds = lateEntries
      .map((e) => e.staffProfileId)
      .filter((id): id is string => !!id);
    if (staffProfileIds.length > 0) {
      await db.staffProfile.updateMany({
        where: { id: { in: staffProfileIds } },
        data: { status: "AVAILABLE" },
      });
    }

    const branchIds = [...new Set(lateEntries.map((e) => e.branchId))];
    for (const branchId of branchIds) {
      await triggerPusher(`branch-${branchId}`, "QUEUE_UPDATED", {
        type: "GRACE_PERIOD_RELEASE",
        branchId,
      });
    }

    await db.auditLog.createMany({
      data: lateEntries.map((entry) => ({
        organizationId: entry.organizationId,
        action: "STATUS_CHANGE",
        entityType: "QueueEntry",
        entityId: entry.id,
        branchId: entry.branchId,
        details: { from: "WAITING", to: "NO_SHOW", reason: "Grace period expired (10 min)" },
      })),
    });

    log.info({ count: lateEntries.length }, "Grace period: released late online bookings");
  } catch (err: unknown) {
    log.error({ err }, "Grace period job error");
  }
}

// ─── Job 2: Auto Clock-Out ───────────────────────────────────────────────────
// Runs every 5 minutes. Clocks out staff who forgot after branch closing time.

async function processAutoClockOut(): Promise<void> {
  const db = getDb();
  const now = new Date();

  // WIB = UTC+7
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const wibHour = wibNow.getUTCHours();
  const wibMinute = wibNow.getUTCMinutes();
  const currentTimeStr = `${String(wibHour).padStart(2, "0")}:${String(wibMinute).padStart(2, "0")}`;

  const todayDow = DAY_MAP[wibNow.getUTCDay()];

  try {
    const closedBranches = await db.operatingHour.findMany({
      where: {
        dayOfWeek: todayDow as DayOfWeek,
        isClosed: false,
        closeTime: { lte: currentTimeStr },
      },
      select: { branchId: true, closeTime: true },
    });

    if (closedBranches.length === 0) return;

    const todayStart = new Date(wibNow);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartUtc = new Date(todayStart.getTime() - wibOffset);

    for (const branch of closedBranches) {
      const [closeH, closeM] = branch.closeTime.split(":").map(Number);
      const closeWib = new Date(todayStart);
      closeWib.setUTCHours(closeH, closeM, 0, 0);
      const closeUtc = new Date(closeWib.getTime() - wibOffset);

      const openAttendances = await db.staffAttendance.findMany({
        where: {
          clockIn: { gte: todayStartUtc },
          clockOut: null,
          staff: {
            user: {
              branchId: branch.branchId,
            },
          },
        },
        select: { id: true },
      });

      if (openAttendances.length === 0) continue;

      await db.staffAttendance.updateMany({
        where: { id: { in: openAttendances.map((a) => a.id) } },
        data: { clockOut: closeUtc, autoClockOut: true },
      });

      log.info({ count: openAttendances.length, branchId: branch.branchId }, "Auto clock-out");
    }
  } catch (err: unknown) {
    log.error({ err }, "Auto clock-out job error");
  }
}

// ─── Job 3: Loyalty Point Expiry ──────────────────────────────────────────────
// Runs daily at 03:00 UTC (10:00 WIB). Zeroes out points past their expiry date.

async function processPointExpiry(): Promise<void> {
  const db = getDb();
  try {
    const { LoyaltyService } = await import("./features/loyalty/loyalty.service.js");
    const result = await LoyaltyService.processPointExpiry(db);
    if (result.accountsProcessed > 0) {
      log.info({ accounts: result.accountsProcessed, expired: result.totalExpired }, "Point expiry");
    }
  } catch (err: unknown) {
    log.error({ err }, "Point expiry job error");
  }
}

// ─── Job 4: Retention Triggers ────────────────────────────────────────────────
// Runs daily at 03:05 UTC (10:05 WIB). Sends at-risk and points-expiry nudges.

async function processRetentionTriggers(): Promise<void> {
  const db = getDb();
  try {
    const { RetentionService } = await import("./features/retention/retention.service.js");
    const { createNotificationService } = await import("./utils/notifications.js");
    const ns = createNotificationService({
      ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
      ONESIGNAL_REST_API_KEY: process.env.ONESIGNAL_REST_API_KEY,
    });
    const result = await RetentionService.processRetentionTriggers(db, ns);
    if (result.atRiskSent > 0 || result.expirySent > 0) {
      log.info({ atRiskSent: result.atRiskSent, expirySent: result.expirySent }, "Retention triggers");
    }
  } catch (err: unknown) {
    log.error({ err }, "Retention job error");
  }
}

// ─── Job 5: Referral Expiry ───────────────────────────────────────────────────
// Runs daily at 03:10 UTC (10:10 WIB). Transitions PENDING referrals older than
// 30 days to EXPIRED so they no longer block future referral applications.

async function processReferralExpiry(): Promise<void> {
  const db = getDb();
  const now = new Date();

  try {
    // Expire referrals that have a set expiresAt date
    const byExpiry = await db.referral.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    });

    // Fallback: expire referrals without expiresAt that are older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const byAge = await db.referral.updateMany({
      where: {
        status: "PENDING",
        expiresAt: null,
        createdAt: { lt: thirtyDaysAgo },
      },
      data: { status: "EXPIRED" },
    });

    const total = byExpiry.count + byAge.count;
    if (total > 0) {
      log.info({ count: total }, "Referral expiry");
    }
  } catch (err: unknown) {
    log.error({ err }, "Referral expiry job error");
  }
}

// ─── Job 6: Anomaly Detection ─────────────────────────────────────────────────
// Runs every 15 minutes. Detects excessive voids, high discounts, off-hours clock-ins.

async function processAnomalyDetection(): Promise<void> {
  const db = getDb();
  try {
    const { AuditService } = await import("./features/audit/audit.service.js");
    const created = await AuditService.detectAnomalies(db);
    if (created > 0) {
      log.info({ count: created }, "Anomaly detection: new anomalies flagged");
    }
  } catch (err: unknown) {
    log.error({ err }, "Anomaly detection job error");
  }
}

// ─── Job 7: Nightly Snapshot Computation ─────────────────────────────────────
// Runs daily at 02:00 UTC (09:00 WIB). Computes BranchDailySnapshot for yesterday.

async function processNightlySnapshots(): Promise<void> {
  const db = getDb();
  try {
    const { AnalyticsService } = await import("./features/analytics/analytics.service.js");
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const result = await AnalyticsService.computeDailySnapshots(db, dateStr);
    log.info({ branches: result.branchesProcessed, date: result.date }, "Nightly snapshots");
  } catch (err: unknown) {
    log.error({ err }, "Nightly snapshot job error");
  }
}

// ─── Job 7b: Weekly churn scores ─────────────────────────────────────────────
// Runs Monday 04:00 UTC. Recomputes ChurnScore for every active branch.

async function processWeeklyChurnScores(): Promise<void> {
  const db = getDb();
  try {
    const { ChurnService } = await import("./features/analytics/churn.service.js");
    const branches = await db.branch.findMany({
      where: { isActive: true },
      select: { id: true, organizationId: true },
    });
    let customersScored = 0;
    for (const b of branches) {
      const r = await ChurnService.computeChurnScores(db, b.id, b.organizationId);
      customersScored += r.customersScored;
    }
    if (branches.length > 0) {
      log.info(
        { branches: branches.length, customersScored },
        "Weekly churn scores computed",
      );
    }
  } catch (err: unknown) {
    log.error({ err }, "Weekly churn job error");
  }
}

// ─── Job 8: Appointment Reminder ──────────────────────────────────────────────
// Runs every 5 minutes. Sends push notifications for bookings scheduled 25–30 min
// from now that are still WAITING. Deduplicates via Notification table (if it exists)
// or auditLog to avoid double sends.

async function processAppointmentReminders(): Promise<void> {
  const db = getDb();
  try {
    const { createNotificationService } = await import("./utils/notifications.js");
    const ns = createNotificationService({
      ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
      ONESIGNAL_REST_API_KEY: process.env.ONESIGNAL_REST_API_KEY,
    });

    const now = new Date();
    const from = new Date(now.getTime() + 25 * 60 * 1000);
    const to = new Date(now.getTime() + 30 * 60 * 1000);

    const upcomingEntries = await db.queueEntry.findMany({
      where: {
        status: "WAITING",
        booking: {
          scheduledAt: { gte: from, lt: to },
        },
      },
      include: {
        booking: { select: { id: true, scheduledAt: true } },
        branch: { select: { name: true } },
      },
    });

    if (upcomingEntries.length === 0) return;

    let sent = 0;
    for (const entry of upcomingEntries) {
      if (!entry.customerId || !entry.booking) continue;

      const existing = await db.auditLog.findFirst({
        where: {
          entityType: "AppointmentReminder",
          entityId: entry.booking.id,
          action: "CREATE",
        },
      });
      if (existing) continue;

      const branchName = entry.branch?.name ?? "the branch";
      await ns.sendPush(
        entry.customerId,
        "Appointment Reminder",
        `Your appointment at ${branchName} is in 30 minutes!`,
        {
          type: "APPOINTMENT_REMINDER",
          bookingId: entry.booking.id,
          branchId: entry.branchId,
        },
      );

      const reminderTitle = "Appointment Reminder";
      const reminderBody = `Your appointment at ${branchName} is in 30 minutes!`;

      await db.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          action: "CREATE",
          entityType: "AppointmentReminder",
          entityId: entry.booking.id,
          branchId: entry.branchId,
          details: { customerId: entry.customerId },
        },
      });

      await db.notification.create({
        data: {
          organizationId: entry.organizationId,
          userId: entry.customerId,
          title: reminderTitle,
          body: reminderBody,
          type: "APPOINTMENT_REMINDER",
          data: { bookingId: entry.booking.id, branchId: entry.branchId },
        },
      }).catch((e: unknown) => log.error({ err: e }, "Notification record create failed"));

      sent++;
    }

    if (sent > 0) {
      log.info({ count: sent }, "Appointment reminders sent");
    }
  } catch (err: unknown) {
    log.error({ err }, "Appointment reminder job error");
  }
}

// ─── Job 8b: Waitlist expiry ─────────────────────────────────────────────────
// Runs every 5 minutes with other 5m jobs. Marks past-slot waitlist rows EXPIRED.

async function processWaitlistExpiry(): Promise<void> {
  const db = getDb();
  try {
    const { WaitlistService } = await import("./features/waitlist/waitlist.service.js");
    const count = await WaitlistService.expireWaitlistEntries(db);
    if (count > 0) {
      log.info({ count }, "Waitlist entries expired");
    }
  } catch (err: unknown) {
    log.error({ err }, "Waitlist expiry job error");
  }
}

// ─── Job 9: Scheduled report delivery ────────────────────────────────────────
// Runs every hour. Sends PDF + CSV for due ReportSchedule rows (nextRunAt <= now).

async function processScheduledReports(): Promise<void> {
  const db = getDb();
  const now = new Date();

  try {
    const { ReportsService } = await import("./features/reports/reports.service.js");
    const { sendEmail } = await import("./utils/email.js");

    const due = await db.reportSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });

    for (const schedule of due) {
      const branchId = ReportsService.resolveScheduleBranchId(schedule);
      if (!branchId) {
        log.warn({ scheduleId: schedule.id }, "Scheduled report skipped: no branchId");
        continue;
      }

      const { dateFrom, dateTo } = ReportsService.resolveScheduleDates(schedule, now);
      let report;
      try {
        report = await ReportsService.generateReport(db, {
          type: schedule.reportType,
          branchId,
          dateFrom,
          dateTo,
        });
      } catch (err: unknown) {
        log.error({ err, scheduleId: schedule.id }, "Scheduled report generate failed");
        continue;
      }

      const pdf = await ReportsService.exportPDF(report, { dateFrom, dateTo });
      const csv = ReportsService.exportCSV(report);
      const baseName = `${report.type}_${dateFrom}_${dateTo}`;

      await sendEmail({
        to: schedule.recipients,
        subject: `Scheduled report: ${report.type} (${dateFrom} – ${dateTo})`,
        html: `<p>Your scheduled <strong>${report.type}</strong> report for ${dateFrom} to ${dateTo} is attached (PDF and CSV).</p>`,
        attachments: [
          { filename: `${baseName}.pdf`, content: pdf, contentType: "application/pdf" },
          { filename: `${baseName}.csv`, content: csv, contentType: "text/csv" },
        ],
      });

      const nextRunAt = ReportsService.computeNextRunAt(schedule.frequency, now);
      await db.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastSentAt: now,
          nextRunAt,
        },
      });
    }

    if (due.length > 0) {
      log.info({ count: due.length }, "Scheduled reports: processed due batch");
    }
  } catch (err: unknown) {
    log.error({ err }, "Scheduled reports job error");
  }
}

// ─── Start all scheduled jobs ────────────────────────────────────────────────

export function startScheduler(): void {
  cron.schedule("*/5 * * * *", () => {
    processNoShowTimeout();
    processGracePeriodRelease();
    processAppointmentReminders();
    processWaitlistExpiry();
  });

  cron.schedule("*/15 * * * *", () => {
    processAutoClockOut();
    processAnomalyDetection();
  });

  cron.schedule("0 3 * * *", () => {
    processPointExpiry();
  });

  cron.schedule("5 3 * * *", () => {
    processRetentionTriggers();
  });

  cron.schedule("10 3 * * *", () => {
    processReferralExpiry();
  });

  cron.schedule("0 2 * * *", () => {
    processNightlySnapshots();
  });

  cron.schedule("15 2 * * *", async () => {
    try {
      const { ForecastService } = await import("./features/analytics/forecast.service.js");
      const db = getDb();
      await ForecastService.computeAllBranches(db);
    } catch (err: unknown) {
      log.error({ err }, "demand forecast computation failed");
    }
  });

  cron.schedule("0 4 * * 1", () => {
    processWeeklyChurnScores();
  });

  cron.schedule("0 * * * *", () => {
    processScheduledReports();
  });

  log.info(
    "Scheduler started: NO_SHOW(5m), GracePeriod(5m), Reminders(5m), WaitlistExpiry(5m), AutoClockOut(15m), Anomaly(15m), PointExpiry(03:00), Retention(03:05), ReferralExpiry(03:10), Snapshots(02:00), DemandForecast(02:15), ChurnWeekly(Mon 04:00 UTC), Reports( hourly )",
  );
}
