# ARCHITECTURAL BLUEPRINT: HONO.JS ENTERPRISE STACK

**Version:** 2.0.0  
**Status:** Approved — Updated for OpenAPIHono pattern (Phase 7)  
**Pattern:** Feature-Driven Layered Architecture with OpenAPI

---

## 01. SYSTEM HIERARCHY (DIRECTORY STRUCTURE)

The application follows a modular domain-driven design to ensure linear scalability and isolation of concerns.

```text
/src
├── /features           # Domain-specific modules (29 modules)
│   └── /<feature>
│       ├── [name].index.ts    # Router & entry point (see SPEC-004)
│       ├── [name].handlers.ts # Controller logic (HTTP layer)
│       ├── [name].schema.ts   # OpenAPI route definitions + Zod schemas
│       └── [name].service.ts  # Business logic & Data access
├── /middlewares        # Cross-cutting concerns (Auth, RBAC, Rate-limiting, Scope, Cache)
├── /utils              # Shared utilities (Env, S3, Pusher, Notifications, Xendit, OpenAPI helpers)
├── index.ts            # Application composition root (middleware chain + route mounting)
├── server.ts           # Node.js HTTP server entry point
└── scheduler.ts        # Background cron jobs (node-cron)
```

---

## 02. TECHNICAL SPECIFICATIONS

### SPEC-001: ENVIRONMENT INTEGRITY

The system must implement a "Fail-Fast" protocol. Validation occurs at runtime initialization via Zod.

```typescript
// src/utils/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);
```

### SPEC-002: OpenAPIHono ROUTE PATTERN

All routes are defined using `@hono/zod-openapi` for type-safe schemas and auto-generated OpenAPI documentation. Schemas are defined in `[name].schema.ts` using `createRoute()`, and handlers are registered via `app.openapi()`.

```typescript
// src/features/auth/auth.schema.ts
import { createRoute, z } from "@hono/zod-openapi";
import { createSuccessSchema, ErrorSchema } from "../../utils/openapi";

export const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      orgSlug: z.string().optional(),
    }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: createSuccessSchema(z.object({
      accessToken: z.string(),
      refreshToken: z.string(),
      user: z.object({ id: z.string(), email: z.string() }),
    })) } }, description: "Login successful" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid credentials" },
  },
});

// src/features/auth/auth.handlers.ts
import type { AppEnv } from "../../index";
import { loginRoute } from "./auth.schema";
import { AuthService } from "./auth.service";

export const loginHandler = async (c: any) => {
  const data = c.req.valid("json");
  const db = c.get("db");
  const result = await AuthService.login(db, data, c.env);
  return c.json({ success: true, data: result });
};
```

### SPEC-003: UNIFIED ERROR RESPONSE

All exceptions must be intercepted and transformed into a standardized JSON payload.

```typescript
app.onError((err, c) => {
  console.error(`[SYSTEM_ERROR]: ${err.stack}`);
  return c.json(
    {
      success: false,
      message: err.message || "Internal Server Error",
    },
    500,
  );
});
```

---

## 03. REFERENCE IMPLEMENTATION (AUTH MODULE)

### A. ROUTING LAYER (Index) — OpenAPIHono

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../index";
import { authMiddleware } from "../../middlewares/auth";
import { loginRoute, meRoute } from "./auth.schema";
import { loginHandler, meHandler } from "./auth.handlers";

const authApp = new OpenAPIHono<AppEnv>();

// Public routes
authApp.openapi(loginRoute, loginHandler);

// Protected routes
authApp.use("/me", authMiddleware());
authApp.openapi(meRoute, meHandler);

export default authApp;
```

### B. SERVICE LAYER

```typescript
// Service functions receive db (Prisma) and env as parameters — no global state
export const AuthService = {
  async login(db: PrismaClient, data: LoginInput, env: Env) {
    const user = await db.user.findUnique({ where: { email: data.email } });
    // ... validate password, generate JWT, return tokens
  },
};
```

---

## 04. COMPOSITION ROOT (Entry Point)

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import authApp from "./features/auth/auth.index";
import queueApp from "./features/queue/queue.index";
// ... 27 more feature imports

const apiApp = new OpenAPIHono<AppEnv>().basePath("/api");

// Middleware chain: logger → CORS → DB → rate-limit → cache
apiApp.use("*", logger());
apiApp.use("*", cors({ origin: "*" }));
apiApp.use("*", async (c, next) => { /* inject Prisma DB */ });

// Mount feature routes (29 modules)
apiApp.route("/auth", authApp);
apiApp.route("/queue", queueApp);
// ... etc

// OpenAPI docs
apiApp.doc("/openapi.json", { openapi: "3.1.0", info: { title: "TMNG SaaS API", version: "1.0.0" } });
apiApp.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

export default apiApp;
```

---

## 05. SPEC-004: ROUTING MIDDLEWARE PATTERNS

Two patterns exist for applying RBAC middleware within `[name].index.ts` files.

### Pattern A — Sub-App with Wildcard Middleware

Use when a single permission group owns all routes in a sub-app. Safe because only one `use("*")` middleware exists per sub-app.

```typescript
// transactions.index.ts — all write routes share the same permission
const writeApp = new OpenAPIHono<AppEnv>();
writeApp.use("*", authMiddleware(), requirePermission("TRANSACTION", "create"));
writeApp.openapi(createRoute, createHandler);
writeApp.openapi(voidRoute, voidHandler);

app.route("/", writeApp);
```

### Pattern B — Flat Path-Specific Middleware

Use when **multiple permission groups** share the same path prefix (e.g., `/:id/*`). Mounting multiple sub-apps at `"/"` with `use("*")` causes middleware from all sub-apps to run on every request, leading to 403 errors from unrelated permission checks.

```typescript
// queue.index.ts — different permissions for /:id/status vs /:id/customer-cancel
queueApp.use("/:id/status", authMiddleware(), requirePermission("QUEUE_MANAGEMENT", "update"));
queueApp.openapi(updateStatusRoute, updateStatusHandler);

queueApp.use("/:id/customer-cancel", authMiddleware(), requireCustomer());
queueApp.openapi(customerCancelRoute, customerCancelHandler);
```

**Rule of thumb:** If a feature has routes with conflicting permission requirements under the same prefix, use Pattern B. Always use `requirePermission()` for database-driven RBAC (never `requireRole()` which is deprecated).

---

## 06. MIDDLEWARE STACK

| Middleware | File | Purpose |
|------------|------|---------|
| `authMiddleware()` | `middlewares/auth.ts` | JWT verification, sets userId/organizationId/tenantRoleId/scope |
| `orgScopeMiddleware()` | `middlewares/scope.ts` | Injects org-scoped Prisma into context |
| `requirePermission(feature, action)` | `middlewares/rbac.ts` | Database-driven RBAC check (25 features, CRUD actions) |
| `requireCustomer()` | `middlewares/rbac.ts` | Verifies user is a customer |
| `requireStaff()` | `middlewares/rbac.ts` | Verifies user is a service provider |
| `platformAuthMiddleware()` | `middlewares/platform-auth.ts` | Platform admin JWT verification |
| Rate limiting | `middlewares/rate-limit.ts` | Sliding-window (auth: 5/min, global: 100/min) |
| Response cache | `middlewares/cache.ts` | LRU GET cache (30s TTL), auto-invalidated on mutations |