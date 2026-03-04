# ARCHITECTURAL BLUEPRINT: HONO.JS ENTERPRISE STACK

**Version:** 1.0.0  
**Status:** Approved  
**Pattern:** Feature-Driven Layered Architecture

---

## 01. SYSTEM HIERARCHY (DIRECTORY STRUCTURE)

The application follows a modular domain-driven design to ensure linear scalability and isolation of concerns.

```text
/src
├── /features           # Domain-specific modules
│   └── /<feature>
│       ├── [name].index.ts    # Router & entry point (see SPEC-004)
│       ├── [name].handlers.ts # Controller logic (HTTP layer)
│       ├── [name].schema.ts   # Zod validation & Type definitions
│       └── [name].service.ts  # Business logic & Data access
├── /lib                # Infrastructure singletons (Prisma, Redis)
├── /middlewares        # Cross-cutting concerns (Auth, Rate-limiting)
├── /utils              # Shared utilities (Env, Formatters)
├── index.ts            # Application composition root
└── client.ts           # Hono RPC type exports
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

### SPEC-002: ROUTE FACTORY PATTERN

To maintain strict type safety across decoupled files, all handlers must be instantiated via `createFactory`.

```typescript
// src/features/auth/auth.handlers.ts
import { createFactory } from "hono/factory";
import { zValidator } from "@hono/zod-validator";
import { loginSchema } from "./auth.schema";

const factory = createFactory();

export const loginHandler = factory.createHandlers(
  zValidator("json", loginSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    return c.json({ message: `Welcome ${email}` });
  },
);
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

### A. DATA CONTRACT (Schema)

```typescript
import { z } from "zod";
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

### B. LOGIC LAYER (Service)

```typescript
export const AuthService = {
  async validateUser(data: any) {
    return { id: "1", email: data.email };
  },
};
```

### C. ROUTING LAYER (Index)

```typescript
import { Hono } from "hono";
import { loginHandler } from "./auth.handlers";

const authApp = new Hono().post("/login", ...loginHandler);
export default authApp;
```

---

## 04. COMPOSITION ROOT (Entry Point)

```typescript
import { Hono } from "hono";
import authApp from "./features/auth/auth.index";

const app = new Hono().basePath("/api").route("/auth", authApp);

export type AppType = typeof app;
export default app;
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

**Rule of thumb:** If a feature has routes with conflicting permission requirements under the same prefix, use Pattern B. Prefer `requirePermission()` over `requireRole()` for database-driven RBAC.