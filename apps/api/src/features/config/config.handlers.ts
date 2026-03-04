import { createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";
import { ConfigService } from "./config.service";
import { updateConfigBody } from "./config.schema";

const jsonRes = z.object({ success: z.boolean(), data: z.any() });

export const listConfigRoute = createRoute({
  method: "get",
  path: "/",
  responses: { 200: { description: "All config values", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Config"],
});

export const listConfigHandler: RouteHandler<typeof listConfigRoute, AppEnv> = async (c) => {
  const data = await ConfigService.getAll(c.var.db);
  return c.json({ success: true, data }, 200);
};

export const updateConfigRoute = createRoute({
  method: "patch",
  path: "/{key}",
  request: {
    params: z.object({ key: z.string() }),
    body: { content: { "application/json": { schema: updateConfigBody } } },
  },
  responses: { 200: { description: "Updated config", content: { "application/json": { schema: jsonRes } } } },
  tags: ["Config"],
});

export const updateConfigHandler: RouteHandler<typeof updateConfigRoute, AppEnv> = async (c) => {
  const { key } = c.req.valid("param");
  const { value } = c.req.valid("json");
  const userId = c.get("userId") as string;
  const organizationId = c.get("organizationId")!;
  const data = await ConfigService.updateValue(c.var.db, key, value, userId, organizationId);
  return c.json({ success: true, data }, 200);
};
