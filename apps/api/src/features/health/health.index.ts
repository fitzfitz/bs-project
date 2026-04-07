import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { getPoolStats } from "../../utils/db";

const VERSION = process.env.npm_package_version ?? "1.0.0";

const healthApp = new OpenAPIHono<AppEnv>().get("/", (c) => {
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  return c.json({
    success: true,
    status: "ok" as const,
    message: "TMNG SaaS API is running",
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: Math.round(process.uptime()),
    memory: {
      rss: toMB(mem.rss),
      heapUsed: toMB(mem.heapUsed),
      heapTotal: toMB(mem.heapTotal),
    },
    db: getPoolStats(),
    services: {
      email: {
        configured: Boolean(c.env?.RESEND_API_KEY && c.env?.RESEND_FROM_EMAIL),
      },
      push: {
        configured: Boolean(
          c.env?.ONESIGNAL_APP_ID && c.env?.ONESIGNAL_REST_API_KEY,
        ),
      },
      whatsapp: {
        configured: Boolean(
          c.env?.TWILIO_ACCOUNT_SID &&
            c.env?.TWILIO_AUTH_TOKEN &&
            c.env?.TWILIO_WHATSAPP_FROM,
        ),
      },
      sms: {
        configured: Boolean(
          c.env?.TWILIO_ACCOUNT_SID &&
            c.env?.TWILIO_AUTH_TOKEN &&
            c.env?.TWILIO_SMS_FROM,
        ),
      },
    },
  });
});

export default healthApp;
