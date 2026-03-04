import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import type { PrismaClient } from "@prisma/client";

const TENANT_MODELS = [
  "user",
  "branch",
  "service",
  "booking",
  "bookingItem",
  "queueEntry",
  "transaction",
  "transactionItem",
  "payment",
  "staffProfile",
  "staffAttendance",
  "staffEarning",
  "shiftSchedule",
  "commissionTier",
  "operatingHour",
  "branchHoliday",
  "comboService",
  "tierSurcharge",
  "branchServiceOverride",
  "surgeRule",
  "product",
  "branchInventory",
  "stockMovement",
  "promoCode",
  "review",
  "referral",
  "customerMembership",
  "loyaltyTransaction",
  "cashDrawerSession",
  "cashDrawerEntry",
  "customerSegment",
  "customerSegmentMember",
  "campaign",
  "auditLog",
  "branchDailySnapshot",
  "anomalyFlag",
  "payrollPeriod",
  "tenantRole",
  "tenantRoleService",
  "refreshToken",
] as const;

/**
 * Creates a Prisma client extension that auto-injects `organizationId`
 * into all `where` clauses for tenant-scoped models.
 */
export function scopeToOrg(db: PrismaClient, orgId: string): PrismaClient {
  const queryOverrides: Record<string, any> = {};

  for (const model of TENANT_MODELS) {
    queryOverrides[model] = {
      async findMany({ args, query }: any) {
        args.where = { ...args.where, organizationId: orgId };
        return query(args);
      },
      async findFirst({ args, query }: any) {
        args.where = { ...args.where, organizationId: orgId };
        return query(args);
      },
      async findUnique({ args, query }: any) {
        return query(args);
      },
      async create({ args, query }: any) {
        args.data = { ...args.data, organizationId: orgId };
        return query(args);
      },
      async createMany({ args, query }: any) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((d: any) => ({
            ...d,
            organizationId: orgId,
          }));
        } else {
          args.data = { ...args.data, organizationId: orgId };
        }
        return query(args);
      },
      async update({ args, query }: any) {
        return query(args);
      },
      async updateMany({ args, query }: any) {
        args.where = { ...args.where, organizationId: orgId };
        return query(args);
      },
      async delete({ args, query }: any) {
        return query(args);
      },
      async deleteMany({ args, query }: any) {
        args.where = { ...args.where, organizationId: orgId };
        return query(args);
      },
      async count({ args, query }: any) {
        args.where = { ...args.where, organizationId: orgId };
        return query(args);
      },
      async aggregate({ args, query }: any) {
        args.where = { ...args.where, organizationId: orgId };
        return query(args);
      },
    };
  }

  return db.$extends({ query: queryOverrides as any }) as unknown as PrismaClient;
}

/**
 * Adds branch-level filtering on top of org-scoped queries
 * for BRANCH-scoped users.
 */
export function scopeToBranch(
  db: PrismaClient,
  branchId: string
): PrismaClient {
  const branchModels = [
    "queueEntry",
    "booking",
    "transaction",
    "cashDrawerSession",
    "branchInventory",
    "stockMovement",
    "surgeRule",
    "operatingHour",
    "branchHoliday",
    "branchServiceOverride",
    "branchDailySnapshot",
    "review",
    "auditLog",
    "anomalyFlag",
    "campaign",
    "customerSegment",
  ] as const;

  const queryOverrides: Record<string, any> = {};

  for (const model of branchModels) {
    queryOverrides[model] = {
      async findMany({ args, query }: any) {
        args.where = { ...args.where, branchId };
        return query(args);
      },
      async findFirst({ args, query }: any) {
        args.where = { ...args.where, branchId };
        return query(args);
      },
      async create({ args, query }: any) {
        args.data = { ...args.data, branchId };
        return query(args);
      },
      async count({ args, query }: any) {
        args.where = { ...args.where, branchId };
        return query(args);
      },
    };
  }

  return db.$extends({ query: queryOverrides as any }) as unknown as PrismaClient;
}

/**
 * Middleware that creates an org-scoped (and optionally branch-scoped)
 * Prisma client and sets it on the context.
 *
 * Must be used AFTER authMiddleware().
 */
export function orgScopeMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const orgId = c.get("organizationId");

    if (!orgId) {
      return c.json(
        { success: false, message: "Forbidden: no organization context" },
        403
      );
    }

    const rawDb = c.get("db");
    let scopedDb = scopeToOrg(rawDb, orgId);

    const scope = c.get("scope");
    const branchId = c.get("branchId");

    if (scope === "BRANCH" && branchId) {
      scopedDb = scopeToBranch(scopedDb, branchId);
    }

    c.set("db", scopedDb);
    await next();
  });
}
