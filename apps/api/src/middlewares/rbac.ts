import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

type Action = "create" | "read" | "update" | "delete";

interface FeaturePerms {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

interface CacheEntry {
  permissions: Map<string, FeaturePerms>;
  loadedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const permissionCache = new Map<string, CacheEntry>();

const ACTION_MAP: Record<Action, keyof FeaturePerms> = {
  create: "canCreate",
  read: "canRead",
  update: "canUpdate",
  delete: "canDelete",
};

async function getPermissionsFromCache(
  db: any,
  tenantRoleId: string
): Promise<Map<string, FeaturePerms>> {
  const cached = permissionCache.get(tenantRoleId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.permissions;
  }

  const rows = await db.tenantRolePermission.findMany({
    where: { tenantRoleId },
    select: {
      featureCode: true,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    },
  });

  const permissions = new Map<string, FeaturePerms>();
  for (const row of rows) {
    permissions.set(row.featureCode, {
      canCreate: row.canCreate,
      canRead: row.canRead,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
    });
  }

  permissionCache.set(tenantRoleId, { permissions, loadedAt: Date.now() });
  return permissions;
}

export function invalidatePermissionCache(tenantRoleId: string) {
  permissionCache.delete(tenantRoleId);
}

export function invalidateAllPermissionCaches() {
  permissionCache.clear();
}

/**
 * RBAC guard — checks that the authenticated user's role has the required
 * permission for a given feature + action.
 *
 * Must be used AFTER authMiddleware().
 *
 * Usage: app.get("/payroll", authMiddleware(), requirePermission("PAYROLL", "read"), handler)
 */
export function requirePermission(featureCode: string, action: Action) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const tenantRoleId = c.get("tenantRoleId");

    if (!tenantRoleId) {
      return c.json(
        { success: false, message: "Forbidden: no role assigned" },
        403
      );
    }

    const db = c.get("db");
    const permissions = await getPermissionsFromCache(db, tenantRoleId);
    const featurePerms = permissions.get(featureCode);

    if (!featurePerms || !featurePerms[ACTION_MAP[action]]) {
      return c.json(
        { success: false, message: "Forbidden: insufficient permissions" },
        403
      );
    }

    await next();
  });
}

/**
 * Convenience guard for customer-only endpoints.
 * Rejects non-customer users.
 */
export function requireCustomer() {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!c.get("isCustomer")) {
      return c.json(
        { success: false, message: "Forbidden: customer-only endpoint" },
        403
      );
    }
    await next();
  });
}

/**
 * Convenience guard for staff/admin endpoints.
 * Rejects customer users.
 */
export function requireStaff() {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.get("isCustomer")) {
      return c.json(
        { success: false, message: "Forbidden: staff-only endpoint" },
        403
      );
    }
    await next();
  });
}
