import { createRoute, z } from "@hono/zod-openapi";
import {
  createBranchSchema,
  updateBranchSchema,
  branchIdParam,
  listBranchesQuery,
  setOperatingHoursSchema,
  createSurgeRuleSchema,
  updateSurgeRuleSchema,
  surgeRuleIdParam,
  createBranchHolidaySchema,
  updateBranchHolidaySchema,
  holidayIdParam,
  BranchScalarSchema,
  BranchWithRelationsSchema,
  BranchDetailSchema,
  OperatingHourResponseSchema,
  SurgeRuleResponseSchema,
  EmergencyCloseResultSchema,
  BranchHolidaySchema,
} from "./branches.schema";
import { BranchesService } from "./branches.service";
import { getPusher } from "../../utils/pusher";
import { createNotificationService } from "../../utils/notifications";
import {
  createSuccessSchema,
  MessageSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

// ============================================================================
// Route Definitions
// ============================================================================

export const listBranchesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Branches"],
  summary: "List branches",
  request: { query: listBranchesQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(BranchWithRelationsSchema)),
        },
      },
      description: "Array of branches",
    },
  },
});

export const getBranchRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Branches"],
  summary: "Get branch by ID",
  request: { params: branchIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(BranchDetailSchema) },
      },
      description: "Branch details",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Branch not found",
    },
  },
});

export const createBranchRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Branches"],
  summary: "Create branch",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createBranchSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: createSuccessSchema(BranchScalarSchema) },
      },
      description: "Branch created",
    },
  },
});

export const updateBranchRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Branches"],
  summary: "Update branch details",
  security: [{ bearerAuth: [] }],
  request: {
    params: branchIdParam,
    body: {
      content: { "application/json": { schema: updateBranchSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(BranchScalarSchema) },
      },
      description: "Branch updated",
    },
  },
});

export const deleteBranchRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Branches"],
  summary: "Deactivate branch",
  security: [{ bearerAuth: [] }],
  request: { params: branchIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Branch deactivated",
    },
  },
});

export const setOperatingHoursRoute = createRoute({
  method: "put",
  path: "/{id}/operating-hours",
  tags: ["Branches (Settings)"],
  summary: "Set operating hours",
  security: [{ bearerAuth: [] }],
  request: {
    params: branchIdParam,
    body: {
      content: { "application/json": { schema: setOperatingHoursSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(OperatingHourResponseSchema)),
        },
      },
      description: "Operating hours updated",
    },
  },
});

export const addSurgeRuleRoute = createRoute({
  method: "post",
  path: "/{id}/surge-rules",
  tags: ["Branches (Settings)"],
  summary: "Add surge rule",
  security: [{ bearerAuth: [] }],
  request: {
    params: branchIdParam,
    body: {
      content: { "application/json": { schema: createSurgeRuleSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createSuccessSchema(SurgeRuleResponseSchema),
        },
      },
      description: "Surge rule created",
    },
  },
});

export const updateSurgeRuleRoute = createRoute({
  method: "patch",
  path: "/{id}/surge-rules/{ruleId}",
  tags: ["Branches (Settings)"],
  summary: "Update surge rule",
  security: [{ bearerAuth: [] }],
  request: {
    params: surgeRuleIdParam,
    body: {
      content: { "application/json": { schema: updateSurgeRuleSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(SurgeRuleResponseSchema),
        },
      },
      description: "Surge rule updated",
    },
  },
});

export const deleteSurgeRuleRoute = createRoute({
  method: "delete",
  path: "/{id}/surge-rules/{ruleId}",
  tags: ["Branches (Settings)"],
  summary: "Delete surge rule",
  security: [{ bearerAuth: [] }],
  request: { params: surgeRuleIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Surge rule deleted",
    },
  },
});

// ============================================================================
// Route Handlers
// ============================================================================

export const listBranchesHandler: RouteHandler<
  typeof listBranchesRoute,
  AppEnv
> = async (c) => {
  const filters = c.req.valid("query");
  const result = await BranchesService.list(c.var.db, filters);
  return c.json({ success: true as const, data: result }, 200);
};

export const getBranchHandler: RouteHandler<
  typeof getBranchRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const branch = await BranchesService.getById(c.var.db, id);
  if (!branch) {
    return c.json(
      { success: false as const, message: "Branch not found" },
      404
    );
  }
  return c.json({ success: true as const, data: branch }, 200);
};

export const createBranchHandler: RouteHandler<
  typeof createBranchRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const data = c.req.valid("json");
  const branch = await BranchesService.create(c.var.db, organizationId, data);
  return c.json({ success: true as const, data: branch }, 201);
};

export const updateBranchHandler: RouteHandler<
  typeof updateBranchRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const branch = await BranchesService.update(c.var.db, id, data);
  return c.json({ success: true as const, data: branch }, 200);
};

export const deleteBranchHandler: RouteHandler<
  typeof deleteBranchRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  await BranchesService.toggleActive(c.var.db, id, false);
  return c.json({ success: true as const, message: "Branch deactivated" }, 200);
};

export const setOperatingHoursHandler: RouteHandler<
  typeof setOperatingHoursRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const hours = await BranchesService.setOperatingHours(c.var.db, id, organizationId, data);
  return c.json({ success: true as const, data: hours }, 200);
};

export const addSurgeRuleHandler: RouteHandler<
  typeof addSurgeRuleRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const rule = await BranchesService.addSurgeRule(c.var.db, id, organizationId, data);
  return c.json({ success: true as const, data: rule }, 201);
};

export const updateSurgeRuleHandler: RouteHandler<
  typeof updateSurgeRuleRoute,
  AppEnv
> = async (c) => {
  const { ruleId } = c.req.valid("param");
  const data = c.req.valid("json");
  const rule = await BranchesService.updateSurgeRule(c.var.db, ruleId, data);
  return c.json({ success: true as const, data: rule }, 200);
};

export const deleteSurgeRuleHandler: RouteHandler<
  typeof deleteSurgeRuleRoute,
  AppEnv
> = async (c) => {
  const { ruleId } = c.req.valid("param");
  await BranchesService.deleteSurgeRule(c.var.db, ruleId);
  return c.json({ success: true as const, message: "Surge rule deleted" }, 200);
};

// ============================================================================
// Emergency Closure
// ============================================================================

export const emergencyCloseRoute = createRoute({
  method: "post",
  path: "/{id}/emergency-close",
  tags: ["Branches (Operations)"],
  summary: "Emergency close a branch",
  security: [{ bearerAuth: [] }],
  request: { params: branchIdParam },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(EmergencyCloseResultSchema),
        },
      },
      description: "Branch emergency-closed",
    },
  },
});

export const reopenBranchRoute = createRoute({
  method: "post",
  path: "/{id}/reopen",
  tags: ["Branches (Operations)"],
  summary: "Reopen an emergency-closed branch",
  security: [{ bearerAuth: [] }],
  request: { params: branchIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(BranchScalarSchema) },
      },
      description: "Branch reopened",
    },
  },
});

export const emergencyCloseHandler: RouteHandler<
  typeof emergencyCloseRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const userId = c.var.userId!;
  const pusher = getPusher(c);
  const ns = createNotificationService(c.env);
  const result = await BranchesService.emergencyClose(c.var.db, id, organizationId, userId, pusher, ns);
  return c.json({ success: true as const, data: result }, 200);
};

export const reopenBranchHandler: RouteHandler<
  typeof reopenBranchRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const userId = c.var.userId!;
  const pusher = getPusher(c);
  const ns = createNotificationService(c.env);
  const result = await BranchesService.reopen(c.var.db, id, organizationId, userId, pusher, ns);
  return c.json({ success: true as const, data: result }, 200);
};

// ============================================================================
// Branch Holidays
// ============================================================================

export const listHolidaysRoute = createRoute({
  method: "get",
  path: "/{id}/holidays",
  tags: ["Branches (Settings)"],
  summary: "List branch holidays",
  request: { params: branchIdParam },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(BranchHolidaySchema)),
        },
      },
      description: "Array of holidays",
    },
  },
});

export const createHolidayRoute = createRoute({
  method: "post",
  path: "/{id}/holidays",
  tags: ["Branches (Settings)"],
  summary: "Create a branch holiday",
  security: [{ bearerAuth: [] }],
  request: {
    params: branchIdParam,
    body: { content: { "application/json": { schema: createBranchHolidaySchema } } },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: createSuccessSchema(BranchHolidaySchema) },
      },
      description: "Holiday created",
    },
  },
});

export const updateHolidayRoute = createRoute({
  method: "patch",
  path: "/{id}/holidays/{holidayId}",
  tags: ["Branches (Settings)"],
  summary: "Update a branch holiday",
  security: [{ bearerAuth: [] }],
  request: {
    params: holidayIdParam,
    body: { content: { "application/json": { schema: updateBranchHolidaySchema } } },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(BranchHolidaySchema) },
      },
      description: "Holiday updated",
    },
  },
});

export const deleteHolidayRoute = createRoute({
  method: "delete",
  path: "/{id}/holidays/{holidayId}",
  tags: ["Branches (Settings)"],
  summary: "Delete a branch holiday",
  security: [{ bearerAuth: [] }],
  request: { params: holidayIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Holiday deleted",
    },
  },
});

export const listHolidaysHandler: RouteHandler<
  typeof listHolidaysRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const holidays = await BranchesService.listHolidays(c.var.db, id);
  return c.json({ success: true as const, data: holidays }, 200);
};

export const createHolidayHandler: RouteHandler<
  typeof createHolidayRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const holiday = await BranchesService.createHoliday(c.var.db, id, organizationId, data);
  return c.json({ success: true as const, data: holiday }, 201);
};

export const updateHolidayHandler: RouteHandler<
  typeof updateHolidayRoute,
  AppEnv
> = async (c) => {
  const { holidayId } = c.req.valid("param");
  const data = c.req.valid("json");
  const holiday = await BranchesService.updateHoliday(c.var.db, holidayId, data);
  return c.json({ success: true as const, data: holiday }, 200);
};

export const deleteHolidayHandler: RouteHandler<
  typeof deleteHolidayRoute,
  AppEnv
> = async (c) => {
  const { holidayId } = c.req.valid("param");
  await BranchesService.deleteHoliday(c.var.db, holidayId);
  return c.json({ success: true as const, message: "Holiday deleted" }, 200);
};
