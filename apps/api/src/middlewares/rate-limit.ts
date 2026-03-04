import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * In-memory sliding window rate limiter.
 * Works per-worker (no cross-request persistence in serverless). For production at scale,
 * consider Cloudflare Rate Limiting API or KV-backed store.
 */
const store = new Map<
  string,
  { count: number; windowStart: number }
>();

const WINDOW_MS = 60 * 1000; // 1 minute

function getClientKey(c: { req: { raw: Request; url: string }; env: AppEnv["Bindings"] }): string {
  const cfIp = c.req.raw.headers.get("cf-connecting-ip");
  const xForwarded = c.req.raw.headers.get("x-forwarded-for");
  const ip = cfIp ?? (xForwarded ? xForwarded.split(",")[0].trim() : null) ?? "unknown";
  return ip;
}

function getLimitKey(ip: string, path: string, method: string): string {
  return `${ip}:${method}:${path}`;
}

function checkLimit(limitKey: string, max: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(limitKey);

  if (!entry) {
    store.set(limitKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (now - entry.windowStart >= WINDOW_MS) {
    store.set(limitKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Auth endpoint limits: login 5/min, register 3/min, refresh 10/min */
const AUTH_LIMITS: { path: string; method: string; max: number }[] = [
  { path: "/api/auth/login", method: "POST", max: 5 },
  { path: "/api/auth/register", method: "POST", max: 3 },
  { path: "/api/auth/refresh", method: "POST", max: 10 },
];

const GLOBAL_MAX = 100;

export function rateLimitMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;
    const method = c.req.method;
    const ip = getClientKey(c);

    const authRule = AUTH_LIMITS.find(
      (r) => r.path === path && r.method === method
    );
    const max = authRule ? authRule.max : GLOBAL_MAX;
    const limitKey = getLimitKey(ip, path, method);

    const { allowed, retryAfter } = checkLimit(limitKey, max);

    if (!allowed) {
      return c.json(
        {
          success: false,
          message: "Too many requests. Please try again later.",
        },
        429,
        {
          "Retry-After": String(retryAfter),
        }
      );
    }

    await next();
  });
}
