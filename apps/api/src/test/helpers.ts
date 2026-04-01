import { vi } from "vitest";
import { sign } from "hono/jwt";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { PrismaClient, RoleScope } from "@prisma/client";
import type { AppEnv } from "../types";

/**
 * Wraps a mock Prisma client so `db.$extends(...)` returns the same client.
 * Required when tests run middleware that calls `scopeToOrg` / `orgScopeMiddleware`.
 */
export function withPrismaScopeChain(db: PrismaClient): PrismaClient {
  return new Proxy(db as object, {
    get(target, prop) {
      if (prop === "$extends") {
        return (_opts: unknown) => db;
      }
      return Reflect.get(target as object, prop);
    },
  }) as PrismaClient;
}

/**
 * Creates a deeply-mocked PrismaClient where each model method is a stable `vi.fn()`.
 * Reuses the same client inside `$transaction` so callbacks see the same stubs.
 */
export function createMockDb(): PrismaClient {
  const modelCaches = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  // eslint-disable-next-line prefer-const
  let prisma: PrismaClient;

  const $transactionFn = vi.fn((arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: PrismaClient) => unknown)(prisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg.map((p) => Promise.resolve(p)));
    }
    return Promise.resolve(arg);
  });

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "then") return undefined;
      if (prop === "$connect" || prop === "$disconnect") return vi.fn();
      if (prop === "$extends") {
        return (_opts: unknown) => prisma;
      }
      if (prop === "$transaction") {
        return $transactionFn;
      }
      const model = prop as string;
      if (!modelCaches.has(model)) {
        modelCaches.set(model, {});
      }
      const methods = modelCaches.get(model)!;
      return new Proxy(
        {},
        {
          get(_, methodProp) {
            const name = methodProp as string;
            if (!methods[name]) {
              methods[name] = vi.fn();
            }
            return methods[name];
          },
        },
      );
    },
  };

  prisma = new Proxy({}, handler) as unknown as PrismaClient;
  return prisma;
}

export type TestUser = {
  userId: string;
  organizationId: string;
  tenantRoleId: string;
  branchId?: string;
  isCustomer?: boolean;
  scope: RoleScope;
};

export const testUsers = {
  superAdmin: {
    userId: "user-super-admin",
    organizationId: "org-1",
    tenantRoleId: "role-owner",
    scope: "HQ" as RoleScope,
    isCustomer: false,
  },
  branchManager: {
    userId: "user-branch-mgr",
    organizationId: "org-1",
    tenantRoleId: "role-manager",
    branchId: "branch-1",
    scope: "BRANCH" as RoleScope,
    isCustomer: false,
  },
  cashier: {
    userId: "user-cashier",
    organizationId: "org-1",
    tenantRoleId: "role-cashier",
    branchId: "branch-1",
    scope: "BRANCH" as RoleScope,
    isCustomer: false,
  },
  barber: {
    userId: "user-barber",
    organizationId: "org-1",
    tenantRoleId: "role-barber",
    branchId: "branch-1",
    scope: "BRANCH" as RoleScope,
    isCustomer: false,
  },
  customer: {
    userId: "user-customer",
    organizationId: "org-1",
    tenantRoleId: "role-customer",
    scope: "CUSTOMER" as RoleScope,
    isCustomer: true,
  },
} satisfies Record<string, TestUser>;

/** Hono `Bindings` with secrets from setup — use as the third argument to `app.request`. */
export function getTestBindings(
  overrides?: Partial<AppEnv["Bindings"]>,
): AppEnv["Bindings"] {
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY ?? "7d",
    NODE_ENV: (process.env.NODE_ENV as "development" | "production") ?? "development",
    PUSHER_APP_ID: process.env.PUSHER_APP_ID!,
    PUSHER_KEY: process.env.PUSHER_KEY!,
    PUSHER_SECRET: process.env.PUSHER_SECRET!,
    PUSHER_CLUSTER: process.env.PUSHER_CLUSTER ?? "mt1",
    PUSHER_HOST: process.env.PUSHER_HOST!,
    PUSHER_PORT: process.env.PUSHER_PORT ?? "6001",
    PUSHER_USE_TLS: process.env.PUSHER_USE_TLS ?? "false",
    ...overrides,
  } as AppEnv["Bindings"];
}

export async function signTestJwt(input: {
  sub: string;
  organizationId: string;
  tenantRoleId: string;
  branchId?: string;
  isCustomer?: boolean;
  scope: RoleScope;
}): Promise<string> {
  return sign(
    {
      sub: input.sub,
      organizationId: input.organizationId,
      tenantRoleId: input.tenantRoleId,
      branchId: input.branchId,
      isCustomer: input.isCustomer ?? false,
      scope: input.scope,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.JWT_SECRET!,
    "HS256",
  );
}

/** Stub `tenantRolePermission.findMany` for `requirePermission` RBAC middleware. */
export function mockTenantRolePermissions(
  db: PrismaClient,
  rows: Array<{
    featureCode: string;
    canCreate?: boolean;
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  }>,
): void {
  const findMany = db.tenantRolePermission.findMany as ReturnType<typeof vi.fn>;
  findMany.mockResolvedValue(
    rows.map((r) => ({
      featureCode: r.featureCode,
      canCreate: r.canCreate ?? false,
      canRead: r.canRead ?? false,
      canUpdate: r.canUpdate ?? false,
      canDelete: r.canDelete ?? false,
    })),
  );
}

/**
 * Mounts a feature `OpenAPIHono` with `db` and JWT `Bindings` on every request.
 * Nested apps do not always receive the third `app.request(..., env)` argument; setting `c.env` here keeps auth working.
 */
export function mountFeatureWithDb(
  featureApp: OpenAPIHono<AppEnv>,
  db: PrismaClient,
  bindings: AppEnv["Bindings"] = getTestBindings(),
): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: AppEnv["Bindings"] }).env = {
      ...((c.env as AppEnv["Bindings"] | undefined) ?? ({} as AppEnv["Bindings"])),
      ...bindings,
    };
    c.set("db", withPrismaScopeChain(db));
    await next();
  });
  app.route("/", featureApp);
  return app;
}
