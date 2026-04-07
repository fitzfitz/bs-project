import { createHash, createHmac } from "node:crypto";
import type { Context } from "hono";
import type { AppEnv } from "../types";

export interface CloudflarePusher {
  trigger(channel: string, event: string, data: any): Promise<void>;
}

export function getPusher(c: Context<AppEnv>): CloudflarePusher | undefined {
  if (!c.env.PUSHER_APP_ID || !c.env.PUSHER_KEY || !c.env.PUSHER_SECRET) {
    return undefined;
  }

  return {
    async trigger(channel: string, event: string, data: any) {
      const appId = c.env.PUSHER_APP_ID;
      const key = c.env.PUSHER_KEY;
      const secret = c.env.PUSHER_SECRET;
      const cluster = c.env.PUSHER_CLUSTER;
      const host = c.env.PUSHER_HOST || `api-${cluster}.pusher.com`;
      const port = c.env.PUSHER_PORT || "443";
      const scheme = c.env.PUSHER_USE_TLS !== "false" ? "https" : "http";

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
        console.log(`[pusher] Triggering ${event} on ${channel} → ${url.split('?')[0]}`);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`[pusher] trigger failed: ${res.status} ${text}`);
        } else {
          console.log(`[pusher] ✅ ${event} on ${channel} sent successfully`);
        }
      } catch (err: any) {
        console.error("[pusher] fetch error:", err.message);
      }
    },
  };
}
