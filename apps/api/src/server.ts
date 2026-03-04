import { serve } from "@hono/node-server";

if (!process.env.DATABASE_URL) {
  const { config } = await import("dotenv");
  config({ path: ".dev.vars" });
}

const { default: app } = await import("./index.js");
const { startScheduler } = await import("./scheduler.js");

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API running on http://localhost:${info.port}`);
  startScheduler();
});
