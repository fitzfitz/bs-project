import { createRoute, z } from "@hono/zod-openapi";
import { createSuccessSchema } from "../../utils/openapi";
import { RolesService } from "./roles.service";
import {
  createRoleSchema,
  updateRoleSchema,
  permissionMatrixSchema,
  roleServicesSchema,
  TenantRoleSchema,
  TenantRoleListItemSchema,
  PermissionMatrixEntrySchema,
  RoleServiceEntrySchema,
} from "./roles.schema";

// --- List Roles ---

export const listRolesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Roles"],
  summary: "List roles for current organization",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Role list",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(TenantRoleListItemSchema)),
        },
      },
    },
  },
});

export const listRolesHandler = async (c: any) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const roles = await RolesService.listRoles(db, organizationId);
  return c.json({ success: true, data: roles }, 200);
};

// --- Create Role ---

export const createRoleRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Roles"],
  summary: "Create a custom role",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createRoleSchema } } },
  },
  responses: {
    201: {
      description: "Role created",
      content: {
        "application/json": {
          schema: createSuccessSchema(TenantRoleSchema),
        },
      },
    },
  },
});

export const createRoleHandler = async (c: any) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const data = c.req.valid("json");
  const role = await RolesService.createRole(db, organizationId, data);
  return c.json({ success: true, data: role }, 201);
};

// --- Update Role ---

export const updateRoleRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Roles"],
  summary: "Update role settings",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateRoleSchema } } },
  },
  responses: {
    200: {
      description: "Role updated",
      content: {
        "application/json": {
          schema: createSuccessSchema(TenantRoleSchema),
        },
      },
    },
    400: {
      description: "Error",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(false), message: z.string() }),
        },
      },
    },
  },
});

export const updateRoleHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  try {
    const role = await RolesService.updateRole(db, id, data);
    return c.json({ success: true, data: role }, 200);
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 400);
  }
};

// --- Delete Role ---

export const deleteRoleRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Roles"],
  summary: "Delete role (blocked for system roles)",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Role deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), message: z.string() }),
        },
      },
    },
    400: {
      description: "Error",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(false), message: z.string() }),
        },
      },
    },
  },
});

export const deleteRoleHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  try {
    await RolesService.deleteRole(db, id);
    return c.json({ success: true, message: "Role deleted" }, 200);
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 400);
  }
};

// --- Permission Matrix ---

export const getPermissionsRoute = createRoute({
  method: "get",
  path: "/{id}/permissions",
  tags: ["Roles"],
  summary: "Get CRUD permission matrix for a role",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Permission matrix",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(PermissionMatrixEntrySchema)),
        },
      },
    },
  },
});

export const getPermissionsHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const perms = await RolesService.getPermissionMatrix(db, id);
  return c.json({ success: true, data: perms }, 200);
};

export const setPermissionsRoute = createRoute({
  method: "put",
  path: "/{id}/permissions",
  tags: ["Roles"],
  summary: "Set entire permission matrix for a role",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ permissions: permissionMatrixSchema }) } } },
  },
  responses: {
    200: {
      description: "Permission matrix updated",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(PermissionMatrixEntrySchema)),
        },
      },
    },
  },
});

export const setPermissionsHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const { permissions } = c.req.valid("json");
  const result = await RolesService.setPermissionMatrix(db, id, permissions);
  return c.json({ success: true, data: result }, 200);
};

// --- Role Services ---

export const getRoleServicesRoute = createRoute({
  method: "get",
  path: "/{id}/services",
  tags: ["Roles"],
  summary: "Get assigned services for a service-provider role",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Service assignments",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(RoleServiceEntrySchema)),
        },
      },
    },
  },
});

export const getRoleServicesHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const services = await RolesService.getRoleServices(db, id);
  return c.json({ success: true, data: services }, 200);
};

export const setRoleServicesRoute = createRoute({
  method: "put",
  path: "/{id}/services",
  tags: ["Roles"],
  summary: "Set assigned services for a service-provider role",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: roleServicesSchema } } },
  },
  responses: {
    200: {
      description: "Service assignments updated",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(RoleServiceEntrySchema)),
        },
      },
    },
  },
});

export const setRoleServicesHandler = async (c: any) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const { id } = c.req.valid("param");
  const { serviceIds } = c.req.valid("json");
  const result = await RolesService.setRoleServices(db, id, organizationId, serviceIds);
  return c.json({ success: true, data: result }, 200);
};
