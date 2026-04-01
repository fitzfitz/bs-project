/**
 * Pluggable notification service: OneSignal (push), Twilio (WhatsApp + SMS).
 * Gracefully degrades to structured log when credentials are absent.
 */
import { logger as rootLogger } from "./logger";

const log = rootLogger.child({ module: "notifications" });

interface NotificationEnv {
  ONESIGNAL_APP_ID?: string;
  ONESIGNAL_REST_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  TWILIO_SMS_FROM?: string;
}

export interface NotificationService {
  sendPush(userId: string, title: string, body: string, data?: Record<string, string>): Promise<boolean>;
  sendWhatsApp(phone: string, templateId: string, vars?: Record<string, string>): Promise<boolean>;
  sendSms(phone: string, body: string): Promise<boolean>;
}

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

export function createNotificationService(env: NotificationEnv): NotificationService {
  const appId = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_REST_API_KEY;
  const pushConfigured = Boolean(appId && apiKey);

  const twilioSid = env.TWILIO_ACCOUNT_SID;
  const twilioToken = env.TWILIO_AUTH_TOKEN;
  const twilioFrom = env.TWILIO_WHATSAPP_FROM;
  const whatsappConfigured = Boolean(twilioSid && twilioToken && twilioFrom);

  const smsFrom = env.TWILIO_SMS_FROM;
  const smsConfigured = Boolean(twilioSid && twilioToken && smsFrom);

  function twilioAuth(): string {
    return `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`;
  }

  function twilioUrl(): string {
    return `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
  }

  return {
    async sendPush(userId, title, body, data) {
      if (!pushConfigured) {
        log.debug({ userId, title }, "push no-op (env not configured)");
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
          log.error({ status: res.status, text }, "OneSignal error");
          return false;
        }
        return true;
      } catch (err: unknown) {
        log.error({ err }, "push send failed");
        return false;
      }
    },

    async sendWhatsApp(phone, templateId, vars) {
      if (!whatsappConfigured) {
        log.debug({ phone, templateId }, "whatsapp no-op (env not configured)");
        return false;
      }

      try {
        const toNumber = phone.startsWith("whatsapp:") ? phone : `whatsapp:+${phone.replace(/^\+/, "")}`;

        const body = new URLSearchParams({
          From: twilioFrom!,
          To: toNumber,
          ContentSid: templateId,
          ...(vars ? { ContentVariables: JSON.stringify(vars) } : {}),
        });

        const res = await fetch(twilioUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: twilioAuth(),
          },
          body: body.toString(),
        });

        if (!res.ok) {
          const text = await res.text();
          log.error({ status: res.status, text }, "Twilio WhatsApp error");
          return false;
        }
        return true;
      } catch (err: unknown) {
        log.error({ err }, "whatsapp send failed");
        return false;
      }
    },

    async sendSms(phone, body) {
      if (!smsConfigured) {
        log.debug({ phone }, "sms no-op (env not configured)");
        return false;
      }

      try {
        const toNumber = `+${phone.replace(/^\+/, "")}`;

        const params = new URLSearchParams({
          From: smsFrom!,
          To: toNumber,
          Body: body,
        });

        const res = await fetch(twilioUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: twilioAuth(),
          },
          body: params.toString(),
        });

        if (!res.ok) {
          const text = await res.text();
          log.error({ status: res.status, text }, "Twilio SMS error");
          return false;
        }
        return true;
      } catch (err: unknown) {
        log.error({ err }, "sms send failed");
        return false;
      }
    },
  };
}
