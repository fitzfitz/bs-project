import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { webhookRoute, webhookHandler } from "./payments.handlers";

const paymentsApp = new OpenAPIHono<AppEnv>();
paymentsApp.openapi(webhookRoute, webhookHandler);

export default paymentsApp;
