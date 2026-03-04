import cron from "node-cron";
import { createHash, createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { DayOfWeek } from "@prisma/client";
import { getPrisma } from "./utils/db.js";

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
      console.error(`[scheduler] Pusher trigger failed: ${res.status}`);
    }
  } catch (err: any) {
    console.error("[scheduler] Pusher fetch error:", err.message);
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

    console.log(
      `[scheduler] NO_SHOW: transitioned ${staleEntries.length} entries`
    );
  } catch (err: any) {
    console.error("[scheduler] NO_SHOW job error:", err.message);
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

    for (const entry of lateEntries) {
      await db.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          action: "STATUS_CHANGE",
          entityType: "QueueEntry",
          entityId: entry.id,
          branchId: entry.branchId,
          details: { from: "WAITING", to: "NO_SHOW", reason: "Grace period expired (10 min)" },
        },
      });
    }

    console.log(
      `[scheduler] Grace period: released ${lateEntries.length} late online bookings`
    );
  } catch (err: any) {
    console.error("[scheduler] Grace period job error:", err.message);
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

      console.log(
        `[scheduler] Auto clock-out: ${openAttendances.length} staff at branch ${branch.branchId}`
      );
    }
  } catch (err: any) {
    console.error("[scheduler] Auto clock-out job error:", err.message);
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
      console.log(
        `[scheduler] Point expiry: ${result.accountsProcessed} accounts, ${result.totalExpired} points expired`
      );
    }
  } catch (err: any) {
    console.error("[scheduler] Point expiry job error:", err.message);
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
      console.log(
        `[scheduler] Retention: ${result.atRiskSent} at-risk nudges, ${result.expirySent} expiry warnings`
      );
    }
  } catch (err: any) {
    console.error("[scheduler] Retention job error:", err.message);
  }
}

// ─── Job 5: Referral Expiry ───────────────────────────────────────────────────
// Runs daily at 03:10 UTC (10:10 WIB). Transitions PENDING referrals older than
// 30 days to EXPIRED so they no longer block future referral applications.

async function processReferralExpiry(): Promise<void> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const result = await db.referral.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lt: thirtyDaysAgo },
      },
      data: { status: "EXPIRED" },
    });

    if (result.count > 0) {
      console.log(
        `[scheduler] Referral expiry: ${result.count} referrals expired`
      );
    }
  } catch (err: any) {
    console.error("[scheduler] Referral expiry job error:", err.message);
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
      console.log(`[scheduler] Anomaly detection: ${created} new anomalies flagged`);
    }
  } catch (err: any) {
    console.error("[scheduler] Anomaly detection job error:", err.message);
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
    console.log(`[scheduler] Nightly snapshots: ${result.branchesProcessed} branches for ${result.date}`);
  } catch (err: any) {
    console.error("[scheduler] Nightly snapshot job error:", err.message);
  }
}

// ─── Start all scheduled jobs ────────────────────────────────────────────────

export function startScheduler(): void {
  cron.schedule("*/5 * * * *", () => {
    processNoShowTimeout();
    processGracePeriodRelease();
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

  console.log("[scheduler] Started: NO_SHOW timeout (5min), Grace period release (5min), Auto clock-out (15min), Anomaly detection (15min), Point expiry (daily 03:00 UTC), Retention (daily 03:05 UTC), Referral expiry (daily 03:10 UTC), Nightly snapshots (daily 02:00 UTC)");
}
