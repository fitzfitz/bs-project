import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  ALLOWED_ORIGINS: z.string().optional(),

  // Pusher / Soketi
  PUSHER_APP_ID: z.string().min(1),
  PUSHER_KEY: z.string().min(1),
  PUSHER_SECRET: z.string().min(1),
  PUSHER_CLUSTER: z.string().default("mt1"),
  PUSHER_HOST: z.string().min(1),
  PUSHER_PORT: z.string().default("443"),
  PUSHER_USE_TLS: z.enum(["true", "false"]).default("true"),

  // Google OAuth (optional – Google login disabled when absent)
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Xendit (optional – omit for CASH-only)
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().optional(),

  // S3 / MinIO (optional – media upload disabled when absent)
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  // OneSignal (optional – notifications logged when absent)
  ONESIGNAL_APP_ID: z.string().optional(),
  ONESIGNAL_REST_API_KEY: z.string().optional(),

  // Twilio (optional – WhatsApp/SMS messages logged when absent)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
