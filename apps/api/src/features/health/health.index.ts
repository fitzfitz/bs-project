import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getPoolStats } from "../../utils/db";

const VERSION = process.env.npm_package_version ?? "1.0.0";

const healthApp = new Hono<AppEnv>().get("/", (c) => {
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
  });
});

export default healthApp;
