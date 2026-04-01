import { createRoute } from "@hono/zod-openapi";
import {
  createServiceSchema,
  updateServiceSchema,
  serviceIdParam,
  listServicesQuery,
  createTierSurchargeSchema,
  addComboChildSchema,
  branchOverrideSchema,
  ServiceScalarSchema,
  ServiceWithRelationsSchema,
  TierSurchargeSchema,
  ComboServiceScalarSchema,
  BranchServiceOverrideSchema,
} from "./services.schema";
import { ServicesService } from "./services.service";
import {
  createSuccessSchema,
  createPaginatedSuccessSchema,
  MessageSuccessSchema,
  ErrorSchema,
} from "../../utils/openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";

// ============================================================================
// Route Definitions
// ============================================================================

export const listServicesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Services (Global Catalog)"],
  summary: "List all services",
  request: { query: listServicesQuery },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(ServiceWithRelationsSchema),
        },
      },
      description: "Array of services with pagination",
    },
  },
});

export const getServiceRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Services (Global Catalog)"],
  summary: "Get service details by ID",
  request: { params: serviceIdParam },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(ServiceWithRelationsSchema),
        },
      },
      description: "Service details",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Service not found",
    },
  },
});

export const createServiceRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Services (Global Catalog)"],
  summary: "Create a new service (Super Admin)",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createServiceSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: createSuccessSchema(ServiceScalarSchema) },
      },
      description: "Service created",
    },
  },
});

export const updateServiceRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Services (Global Catalog)"],
  summary: "Update an existing service (Super Admin)",
  security: [{ bearerAuth: [] }],
  request: {
    params: serviceIdParam,
    body: {
      content: { "application/json": { schema: updateServiceSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: createSuccessSchema(ServiceScalarSchema) },
      },
      description: "Service updated",
    },
  },
});

export const deleteServiceRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Services (Global Catalog)"],
  summary: "Deactivate service",
  security: [{ bearerAuth: [] }],
  request: { params: serviceIdParam },
  responses: {
    200: {
      content: { "application/json": { schema: MessageSuccessSchema } },
      description: "Service deactivated",
    },
  },
});

export const addTierSurchargeRoute = createRoute({
  method: "post",
  path: "/{id}/tier-surcharge",
  tags: ["Services (Global Catalog)"],
  summary: "Add tier surcharge to service",
  security: [{ bearerAuth: [] }],
  request: {
    params: serviceIdParam,
    body: {
      content: { "application/json": { schema: createTierSurchargeSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: createSuccessSchema(TierSurchargeSchema) },
      },
      description: "Tier surcharge recorded",
    },
  },
});

export const addComboChildRoute = createRoute({
  method: "post",
  path: "/{id}/combo",
  tags: ["Services (Global Catalog)"],
  summary: "Add child service to combo",
  security: [{ bearerAuth: [] }],
  request: {
    params: serviceIdParam,
    body: {
      content: { "application/json": { schema: addComboChildSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createSuccessSchema(ComboServiceScalarSchema),
        },
      },
      description: "Combo link created",
    },
  },
});

export const setBranchOverrideRoute = createRoute({
  method: "post",
  path: "/{id}/branch-override",
  tags: ["Services (Branch Overrides)"],
  summary: "Set branch override for global service",
  security: [{ bearerAuth: [] }],
  request: {
    params: serviceIdParam,
    body: {
      content: { "application/json": { schema: branchOverrideSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(BranchServiceOverrideSchema),
        },
      },
      description: "Override saved",
    },
  },
});

// ============================================================================
// Route Handlers
// ============================================================================

export const listServicesHandler: RouteHandler<
  typeof listServicesRoute,
  AppEnv
> = async (c) => {
  const filters = c.req.valid("query");
  const result = await ServicesService.list(c.var.db, filters);
  return c.json(
    {
      success: true as const,
      data: result.data,
      pagination: result.pagination,
    },
    200
  );
};

export const getServiceHandler: RouteHandler<
  typeof getServiceRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const service = await ServicesService.getById(c.var.db, id);
  
  if (!service) {
    return c.json(
      { success: false as const, message: "Service not found" },
      404
    );
  }
  return c.json({ success: true as const, data: service }, 200);
};

export const createServiceHandler: RouteHandler<
  typeof createServiceRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const data = c.req.valid("json");
  const service = await ServicesService.create(c.var.db, organizationId, data);
  return c.json({ success: true as const, data: service }, 201);
};

export const updateServiceHandler: RouteHandler<
  typeof updateServiceRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const service = await ServicesService.update(c.var.db, id, data);
  return c.json({ success: true as const, data: service }, 200);
};

export const deleteServiceHandler: RouteHandler<
  typeof deleteServiceRoute,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  await ServicesService.delete(c.var.db, id);
  return c.json(
    { success: true as const, message: "Service deactivated" },
    200
  );
};

export const addTierSurchargeHandler: RouteHandler<
  typeof addTierSurchargeRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const surcharge = await ServicesService.addTierSurcharge(
    c.var.db,
    id,
    organizationId,
    data.tier,
    data.surcharge
  );
  return c.json({ success: true as const, data: surcharge }, 201);
};

export const addComboChildHandler: RouteHandler<
  typeof addComboChildRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const combo = await ServicesService.addComboChild(c.var.db, id, organizationId, data.childServiceId);
  return c.json({ success: true as const, data: combo }, 201);
};

export const setBranchOverrideHandler: RouteHandler<
  typeof setBranchOverrideRoute,
  AppEnv
> = async (c) => {
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const override = await ServicesService.setBranchOverride(
    c.var.db,
    id,
    data.branchId,
    organizationId,
    data.overridePrice,
    data.isActive
  );
  return c.json({ success: true as const, data: override }, 200);
};
