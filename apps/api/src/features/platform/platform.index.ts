import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { platformAuthMiddleware } from "../../middlewares/platform-auth";
import {
  platformLoginRoute,
  platformLoginHandler,
  listOrgsRoute,
  listOrgsHandler,
  getOrgRoute,
  getOrgHandler,
  createOrgRoute,
  createOrgHandler,
  updateOrgRoute,
  updateOrgHandler,
  deactivateOrgRoute,
  deactivateOrgHandler,
  listFeaturesRoute,
  listFeaturesHandler,
  listTemplatesRoute,
  listTemplatesHandler,
  listConfigRoute,
  listConfigHandler,
  setConfigRoute,
  setConfigHandler,
} from "./platform.handlers";

const platformApp = new OpenAPIHono<AppEnv>();

platformApp.openapi(platformLoginRoute, platformLoginHandler);

const protectedApp = new OpenAPIHono<AppEnv>();
protectedApp.use("*", platformAuthMiddleware());

protectedApp.openapi(listOrgsRoute, listOrgsHandler);
protectedApp.openapi(getOrgRoute, getOrgHandler);
protectedApp.openapi(createOrgRoute, createOrgHandler);
protectedApp.openapi(updateOrgRoute, updateOrgHandler);
protectedApp.openapi(deactivateOrgRoute, deactivateOrgHandler);
protectedApp.openapi(listFeaturesRoute, listFeaturesHandler);
protectedApp.openapi(listTemplatesRoute, listTemplatesHandler);
protectedApp.openapi(listConfigRoute, listConfigHandler);
protectedApp.openapi(setConfigRoute, setConfigHandler);

platformApp.route("/", protectedApp);

export default platformApp;
