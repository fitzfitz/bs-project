import { Resend } from "resend";
import { logger as rootLogger } from "./logger";

const log = rootLogger.child({ module: "notifications" });

interface NotificationEnv {
  ONESIGNAL_APP_ID?: string;
  ONESIGNAL_REST_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  TWILIO_SMS_FROM?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export interface NotificationService {
  sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean>;
  sendEmail(
    userId: string,
    subject: string,
    htmlBody: string,
  ): Promise<boolean>;
  sendWhatsApp(
    phone: string,
    templateId: string,
    vars?: Record<string, string>,
  ): Promise<boolean>;
  sendSms(phone: string, body: string): Promise<boolean>;
}

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

export function createNotificationService(
  env: NotificationEnv,
  db?: any,
): NotificationService {
  const appId = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_REST_API_KEY;
  const pushConfigured = Boolean(appId && apiKey);

  const resendApiKey = env.RESEND_API_KEY;
  const resendFrom = env.RESEND_FROM_EMAIL;
  const emailConfigured = Boolean(resendApiKey && resendFrom);
  const resend = emailConfigured ? new Resend(resendApiKey) : null;

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

    async sendEmail(userId, subject, htmlBody) {
      if (!emailConfigured || !resend) {
        log.debug(
          { userId, subject },
          "email no-op (Resend env not configured)",
        );
        return false;
      }

      try {
        // Resolve userId to email address
        let toEmail: string | null = null;
        if (db) {
          const user = await db.user.findUnique({
            where: { id: userId },
            select: { email: true },
          });
          toEmail = user?.email;
        }

        if (!toEmail) {
          log.warn(
            { userId },
            "email send failed: user has no email address or db lookup failed",
          );
          return false;
        }

        const { data, error } = await resend.emails.send({
          from: resendFrom!,
          to: toEmail,
          subject,
          html: htmlBody,
        });
        console.log({
          from: resendFrom!,
          to: toEmail,
          subject,
        });

        if (error) {
          log.error({ userId, error }, "Resend email error");
          return false;
        }

        log.debug({ userId, id: data?.id }, "Resend email sent");
        return true;
      } catch (err: unknown) {
        log.error({ err }, "email send failed");
        return false;
      }
    },

    async sendWhatsApp(phone, templateId, vars) {
      if (!whatsappConfigured) {
        log.debug({ phone, templateId }, "whatsapp no-op (env not configured)");
        return false;
      }

      try {
        const toNumber = phone.startsWith("whatsapp:")
          ? phone
          : `whatsapp:+${phone.replace(/^\+/, "")}`;

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
