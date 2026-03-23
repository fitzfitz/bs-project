import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { orgScopeMiddleware } from "../../middlewares/scope";
import { uploadRoute, uploadHandler, deleteRoute, deleteHandler } from "./media.handlers";

const mediaApp = new OpenAPIHono<AppEnv>();

mediaApp.use("*", authMiddleware(), orgScopeMiddleware());
mediaApp.openapi(uploadRoute, uploadHandler);
mediaApp.openapi(deleteRoute, deleteHandler);

export default mediaApp;
