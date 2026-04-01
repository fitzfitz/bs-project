import { beforeAll, afterAll, vi } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
  process.env.JWT_REFRESH_SECRET =
    "test-jwt-refresh-secret-that-is-at-least-32-chars";
  process.env.JWT_ACCESS_EXPIRY = "15m";
  process.env.JWT_REFRESH_EXPIRY = "7d";
  process.env.NODE_ENV = "development";
  process.env.PUSHER_APP_ID = "test-app";
  process.env.PUSHER_KEY = "test-key";
  process.env.PUSHER_SECRET = "test-secret";
  process.env.PUSHER_CLUSTER = "mt1";
  process.env.PUSHER_HOST = "localhost";
  process.env.PUSHER_PORT = "6001";
  process.env.PUSHER_USE_TLS = "false";
  process.env.TWILIO_ACCOUNT_SID = "";
  process.env.TWILIO_AUTH_TOKEN = "";
  process.env.TWILIO_WHATSAPP_FROM = "";
});

afterAll(() => {
  vi.restoreAllMocks();
});
