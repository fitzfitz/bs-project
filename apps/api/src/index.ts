import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";

import type { AppEnv } from "./types";
import { getPrisma, isConnectionError } from "./utils/db";
import { rateLimitMiddleware } from "./middlewares/rate-limit";
import { cacheMiddleware } from "./middlewares/cache";
import authApp from "./features/auth/auth.index";
import healthApp from "./features/health/health.index";
import servicesApp from "./features/services/services.index";
import branchesApp from "./features/branches/branches.index";
import staffApp from "./features/staff/staff.index";
import attendanceApp from "./features/attendance/attendance.index";
import queueApp from "./features/queue/queue.index";
import transactionsApp from "./features/transactions/transactions.index";
import promotionsApp from "./features/promotions/promotions.index";
import commissionsApp from "./features/commissions/commissions.index";
import inventoryApp from "./features/inventory/inventory.index";
import paymentsApp from "./features/payments/payments.index";
import payrollApp from "./features/payroll/payroll.index";
import loyaltyApp from "./features/loyalty/loyalty.index";
import cashDrawerApp from "./features/cash-drawer/cash-drawer.index";
import mediaApp from "./features/media/media.index";
import referralsApp from "./features/referrals/referrals.index";
import reviewsApp from "./features/reviews/reviews.index";
import crmApp from "./features/crm/crm.index";
import campaignsApp from "./features/campaigns/campaigns.index";
import retentionApp from "./features/retention/retention.index";
import usersApp from "./features/users/users.index";
import auditApp from "./features/audit/audit.index";
import analyticsApp from "./features/analytics/analytics.index";
import reportsApp from "./features/reports/reports.index";
import financeApp from "./features/finance/finance.index";
import configApp from "./features/config/config.index";
import platformApp from "./features/platform/platform.index";
import rolesApp from "./features/roles/roles.index";

const app = new OpenAPIHono<AppEnv>();

// Bridge process.env into Hono's c.env for Node.js runtime.
// In Workers, c.env is already populated by the runtime; this is a no-op.
app.use("*", async (c, next) => {
  if (!c.env?.DATABASE_URL && typeof process !== "undefined") {
    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined) {
        (c.env as Record<string, string>)[key] = val;
      }
    }
  }
  await next();
});

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Org-Slug"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  })
);
app.use("*", async (c, next) => {
  const db = getPrisma(c.env.DATABASE_URL);
  c.set("db", db);
  await next();
});

const apiApp = app.basePath("/api");

apiApp.use("*", rateLimitMiddleware());

// In-memory GET response cache for read-heavy endpoints (30s TTL).
// Mutations on the same path automatically invalidate matching entries.
const cachedPaths = ["/queue", "/branches", "/staff", "/services"];
for (const p of cachedPaths) {
  apiApp.use(p, cacheMiddleware(30_000));
  apiApp.use(`${p}/*`, cacheMiddleware(30_000));
}

// OpenAPI docs UI
apiApp.get("/docs", swaggerUI({ url: "/api/openapi.json" }));
apiApp.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "TMNG SaaS API",
    version: "1.0.0",
    description: "Multi-tenant SaaS API for service businesses",
  },
  servers: [{ url: "/api" }],
});

// Feature routes
apiApp.route("/health", healthApp);
apiApp.route("/auth", authApp);
apiApp.route("/services", servicesApp);
apiApp.route("/branches", branchesApp);
apiApp.route("/staff", staffApp);
apiApp.route("/attendance", attendanceApp);
apiApp.route("/queue", queueApp);
apiApp.route("/transactions", transactionsApp);
apiApp.route("/promotions", promotionsApp);
apiApp.route("/commissions", commissionsApp);
apiApp.route("/inventory", inventoryApp);
apiApp.route("/payments", paymentsApp);
apiApp.route("/payroll", payrollApp);
apiApp.route("/loyalty", loyaltyApp);
apiApp.route("/cash-drawer", cashDrawerApp);
apiApp.route("/media", mediaApp);
apiApp.route("/referrals", referralsApp);
apiApp.route("/reviews", reviewsApp);
apiApp.route("/crm", crmApp);
apiApp.route("/campaigns", campaignsApp);
apiApp.route("/retention", retentionApp);
apiApp.route("/users", usersApp);
apiApp.route("/audit", auditApp);
apiApp.route("/analytics", analyticsApp);
apiApp.route("/reports", reportsApp);
apiApp.route("/finance", financeApp);
apiApp.route("/config", configApp);
apiApp.route("/platform", platformApp);
apiApp.route("/roles", rolesApp);

app.onError((err, c) => {
  console.error(`[SYSTEM_ERROR]: ${err.stack}`);
  const msg = err.message ?? "";
  const connErr = isConnectionError(err);
  const status = connErr ? 503 : 500;
  const body = connErr
    ? {
        success: false,
        message:
          c.env.NODE_ENV === "production"
            ? "Service temporarily unavailable. Please retry."
            : msg,
      }
    : {
        success: false,
        message:
          c.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : msg || "Internal Server Error",
      };
  const origin = c.req.header("Origin") || "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Org-Slug");
  if (origin !== "*") c.header("Access-Control-Allow-Credentials", "true");
  return c.json(body, status);
});

app.notFound((c) => {
  return c.json({ success: false, message: "Not Found" }, 404);
});

export type AppType = typeof app;
export default app;
