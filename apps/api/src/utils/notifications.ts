/**
 * Pluggable notification service backed by OneSignal REST API.
 * Gracefully degrades to console.log when credentials are absent.
 */

interface NotificationEnv {
  ONESIGNAL_APP_ID?: string;
  ONESIGNAL_REST_API_KEY?: string;
}

export interface NotificationService {
  sendPush(userId: string, title: string, body: string, data?: Record<string, string>): Promise<boolean>;
}

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

export function createNotificationService(env: NotificationEnv): NotificationService {
  const appId = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_REST_API_KEY;
  const configured = Boolean(appId && apiKey);

  return {
    async sendPush(userId, title, body, data) {
      if (!configured) {
        console.log(`[notifications] (no-op) push → ${userId}: ${title} — ${body}`);
        return false;
      }

      try {
        const res = await fetch(ONESIGNAL_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify({
            app_id: appId,
            include_aliases: { external_id: [userId] },
            target_channel: "push",
            headings: { en: title },
            contents: { en: body },
            ...(data ? { data } : {}),
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(`[notifications] OneSignal error ${res.status}: ${text}`);
          return false;
        }
        return true;
      } catch (err: any) {
        console.error("[notifications] push failed:", err.message);
        return false;
      }
    },
  };
}
