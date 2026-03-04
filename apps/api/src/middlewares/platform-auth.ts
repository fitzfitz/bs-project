import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { verify } from "hono/jwt";

/**
 * Platform admin auth middleware — verifies JWT was issued for a PlatformAdmin.
 * Platform admin JWTs include `{ sub, platformAdmin: true }`.
 * Rejects tenant-user tokens.
 */
export function platformAuthMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    try {
      const payload = await verify(token, c.env.JWT_SECRET, "HS256");

      if (!payload.platformAdmin) {
        return c.json(
          { success: false, message: "Forbidden: platform admin access required" },
          403
        );
      }

      c.set("userId", payload.sub as string);
      await next();
    } catch {
      return c.json({ success: false, message: "Invalid token" }, 401);
    }
  });
}
