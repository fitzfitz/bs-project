import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { verify } from "hono/jwt";
import type { RoleScope } from "@prisma/client";

/**
 * Auth middleware — verifies JWT access token and sets user context
 * variables from the signed JWT claims.
 *
 * JWT payload shape after refactor:
 *   { sub, organizationId, tenantRoleId, branchId?, isCustomer, scope }
 */
export function authMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    try {
      const payload = await verify(token, c.env.JWT_SECRET, "HS256");

      c.set("userId", payload.sub as string);
      c.set("organizationId", payload.organizationId as string);
      c.set("tenantRoleId", payload.tenantRoleId as string);
      c.set("branchId", (payload.branchId as string) || undefined);
      c.set("isCustomer", payload.isCustomer as boolean);
      c.set("scope", payload.scope as RoleScope);

      await next();
    } catch {
      return c.json({ success: false, message: "Invalid token" }, 401);
    }
  });
}
