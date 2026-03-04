import type { Env } from "./utils/env";

import type { PrismaClient, RoleScope } from "@prisma/client";

export type AppEnv = {
  Bindings: Env & {
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    NODE_ENV: string;

    // WebSockets (Soketi)
    PUSHER_APP_ID: string;
    PUSHER_KEY: string;
    PUSHER_SECRET: string;
    PUSHER_CLUSTER: string;
    PUSHER_HOST: string;
    PUSHER_PORT: string;
    PUSHER_USE_TLS: string;
  };
  Variables: {
    db: PrismaClient;
    userId?: string;
    organizationId?: string;
    tenantRoleId?: string;
    branchId?: string;
    isCustomer?: boolean;
    scope?: RoleScope;
  };
};
