import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { authMiddleware } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/rbac";
import { orgScopeMiddleware } from "../../middlewares/scope";
import {
  listBranchesRoute,
  listBranchesHandler,
  getBranchRoute,
  getBranchHandler,
  createBranchRoute,
  createBranchHandler,
  updateBranchRoute,
  updateBranchHandler,
  deleteBranchRoute,
  deleteBranchHandler,
  setOperatingHoursRoute,
  setOperatingHoursHandler,
  addSurgeRuleRoute,
  addSurgeRuleHandler,
  updateSurgeRuleRoute,
  updateSurgeRuleHandler,
  deleteSurgeRuleRoute,
  deleteSurgeRuleHandler,
  emergencyCloseRoute,
  emergencyCloseHandler,
  reopenBranchRoute,
  reopenBranchHandler,
  listHolidaysRoute,
  listHolidaysHandler,
  createHolidayRoute,
  createHolidayHandler,
  updateHolidayRoute,
  updateHolidayHandler,
  deleteHolidayRoute,
  deleteHolidayHandler,
} from "./branches.handlers";

const branchesApp = new OpenAPIHono<AppEnv>();

// Public (no auth)
branchesApp.openapi(listBranchesRoute, listBranchesHandler);
branchesApp.openapi(getBranchRoute, getBranchHandler);
branchesApp.openapi(listHolidaysRoute, listHolidaysHandler);

// Create
branchesApp.use("/", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "create"));
branchesApp.openapi(createBranchRoute, createBranchHandler);

// Update
branchesApp.use("/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(updateBranchRoute, updateBranchHandler);

// Delete
branchesApp.use("/:id", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "delete"));
branchesApp.openapi(deleteBranchRoute, deleteBranchHandler);

// Branch settings
branchesApp.use("/:id/operating-hours", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(setOperatingHoursRoute, setOperatingHoursHandler);

branchesApp.use("/:id/surge-rules", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(addSurgeRuleRoute, addSurgeRuleHandler);

branchesApp.use("/:id/surge-rules/:ruleId", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(updateSurgeRuleRoute, updateSurgeRuleHandler);

branchesApp.use("/:id/surge-rules/:ruleId", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "delete"));
branchesApp.openapi(deleteSurgeRuleRoute, deleteSurgeRuleHandler);

// Emergency
branchesApp.use("/:id/emergency-close", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(emergencyCloseRoute, emergencyCloseHandler);

branchesApp.use("/:id/reopen", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(reopenBranchRoute, reopenBranchHandler);

// Holidays
branchesApp.use("/:id/holidays", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "create"));
branchesApp.openapi(createHolidayRoute, createHolidayHandler);

branchesApp.use("/:id/holidays/:holidayId", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "update"));
branchesApp.openapi(updateHolidayRoute, updateHolidayHandler);

branchesApp.use("/:id/holidays/:holidayId", authMiddleware(), orgScopeMiddleware(), requirePermission("BRANCH_MANAGEMENT", "delete"));
branchesApp.openapi(deleteHolidayRoute, deleteHolidayHandler);

export default branchesApp;
