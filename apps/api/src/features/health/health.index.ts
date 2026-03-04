import { Hono } from "hono";
import type { AppEnv } from "../../types";

const healthApp = new Hono<AppEnv>().get("/", (c) => {
  return c.json({
    success: true,
    message: "TMNG SaaS API is running",
    timestamp: new Date().toISOString(),
  });
});

export default healthApp;
