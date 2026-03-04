import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listProductsRoute,
  listProductsHandler,
  createProductRoute,
  createProductHandler,
  getProductRoute,
  getProductHandler,
  updateProductRoute,
  updateProductHandler,
  deleteProductRoute,
  deleteProductHandler,
  getBranchInventoryRoute,
  getBranchInventoryHandler,
  getLowStockAlertsRoute,
  getLowStockAlertsHandler,
  getValuationRoute,
  getValuationHandler,
  stockInRoute,
  stockInHandler,
  stockOutRoute,
  stockOutHandler,
  adjustStockRoute,
  adjustStockHandler,
} from "./inventory.handlers";

const inventoryApp = new OpenAPIHono<AppEnv>();

const readApp = new OpenAPIHono<AppEnv>();
readApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("INVENTORY", "read"));
readApp.openapi(listProductsRoute, listProductsHandler);
readApp.openapi(getProductRoute, getProductHandler);
readApp.openapi(getBranchInventoryRoute, getBranchInventoryHandler);
readApp.openapi(getLowStockAlertsRoute, getLowStockAlertsHandler);
readApp.openapi(getValuationRoute, getValuationHandler);

const writeStockApp = new OpenAPIHono<AppEnv>();
writeStockApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("INVENTORY", "update"));
writeStockApp.openapi(stockInRoute, stockInHandler);
writeStockApp.openapi(stockOutRoute, stockOutHandler);
writeStockApp.openapi(adjustStockRoute, adjustStockHandler);

const writeProductApp = new OpenAPIHono<AppEnv>();
writeProductApp.use("*", authMiddleware(), orgScopeMiddleware(), requirePermission("INVENTORY", "create"));
writeProductApp.openapi(createProductRoute, createProductHandler);
writeProductApp.openapi(updateProductRoute, updateProductHandler);
writeProductApp.openapi(deleteProductRoute, deleteProductHandler);

inventoryApp.route("/", readApp);
inventoryApp.route("/", writeStockApp);
inventoryApp.route("/", writeProductApp);

export default inventoryApp;
