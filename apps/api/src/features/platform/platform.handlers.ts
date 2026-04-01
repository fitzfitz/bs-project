import { createRoute, z } from "@hono/zod-openapi";
import { PlatformService } from "./platform.service";
import {
  platformLoginSchema,
  createOrgSchema,
  updateOrgSchema,
  platformConfigSchema,
  PlatformLoginSuccessDataSchema,
  OrganizationListItemSchema,
  OrganizationDetailSchema,
  OrganizationCreatedSchema,
  OrganizationScalarsSchema,
  FeatureResponseSchema,
  IndustryTemplateSchema,
  PlatformConfigSchema,
} from "./platform.schema";
import { createSuccessSchema } from "../../utils/openapi";
import { sign } from "hono/jwt";

// --- Auth ---

export const platformLoginRoute = createRoute({
  method: "post",
  path: "/auth/login",
  tags: ["Platform"],
  summary: "Platform admin login",
  request: {
    body: { content: { "application/json": { schema: platformLoginSchema } } },
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: createSuccessSchema(PlatformLoginSuccessDataSchema),
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(false), message: z.string() }),
        },
      },
    },
  },
});

export const platformLoginHandler = async (c: any) => {
  const { email, password } = c.req.valid("json");
  const db = c.get("db");
  const admin = await PlatformService.loginAdmin(db, email, password);
  if (!admin) {
    return c.json({ success: false, message: "Invalid credentials" }, 401);
  }
  const token = await sign(
    {
      sub: admin.id,
      email: admin.email,
      platformAdmin: true,
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    c.env.JWT_SECRET,
    "HS256"
  );
  const { passwordHash: _, ...safeAdmin } = admin;
  return c.json({ success: true, data: { token, admin: safeAdmin } }, 200);
};

// --- Organizations ---

export const listOrgsRoute = createRoute({
  method: "get",
  path: "/organizations",
  tags: ["Platform"],
  summary: "List all organizations",
  request: {
    query: z.object({
      isActive: z.enum(["true", "false"]).optional(),
      industry: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Organization list",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(OrganizationListItemSchema)),
        },
      },
    },
  },
});

export const listOrgsHandler = async (c: any) => {
  const db = c.get("db");
  const query = c.req.valid("query");
  const filters = {
    isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
    industry: query.industry,
  };
  const orgs = await PlatformService.listOrganizations(db, filters);
  return c.json({ success: true, data: orgs }, 200);
};

export const getOrgRoute = createRoute({
  method: "get",
  path: "/organizations/{id}",
  tags: ["Platform"],
  summary: "Get organization details",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Organization details",
      content: {
        "application/json": {
          schema: createSuccessSchema(OrganizationDetailSchema),
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(false), message: z.string() }),
        },
      },
    },
  },
});

export const getOrgHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const org = await PlatformService.getOrganizationById(db, id);
  if (!org) return c.json({ success: false, message: "Organization not found" }, 404);
  return c.json({ success: true, data: org }, 200);
};

export const createOrgRoute = createRoute({
  method: "post",
  path: "/organizations",
  tags: ["Platform"],
  summary: "Create organization with owner account",
  request: {
    body: { content: { "application/json": { schema: createOrgSchema } } },
  },
  responses: {
    201: {
      description: "Organization created",
      content: {
        "application/json": {
          schema: createSuccessSchema(OrganizationCreatedSchema),
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(false), message: z.string() }),
        },
      },
    },
  },
});

export const createOrgHandler = async (c: any) => {
  const db = c.get("db");
  const data = c.req.valid("json");
  try {
    const result = await PlatformService.createOrganization(db, data);
    return c.json({ success: true, data: result }, 201);
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 400);
  }
};

export const updateOrgRoute = createRoute({
  method: "patch",
  path: "/organizations/{id}",
  tags: ["Platform"],
  summary: "Update organization settings",
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateOrgSchema } } },
  },
  responses: {
    200: {
      description: "Organization updated",
      content: {
        "application/json": {
          schema: createSuccessSchema(OrganizationScalarsSchema),
        },
      },
    },
  },
});

export const updateOrgHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const org = await PlatformService.updateOrganization(db, id, data);
  return c.json({ success: true, data: org }, 200);
};

export const deactivateOrgRoute = createRoute({
  method: "delete",
  path: "/organizations/{id}",
  tags: ["Platform"],
  summary: "Deactivate organization (soft delete)",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Organization deactivated",
      content: {
        "application/json": {
          schema: createSuccessSchema(OrganizationScalarsSchema),
        },
      },
    },
  },
});

export const deactivateOrgHandler = async (c: any) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  const org = await db.organization.update({
    where: { id },
    data: { isActive: false },
  });
  return c.json({ success: true, data: org }, 200);
};

// --- Features ---

export const listFeaturesRoute = createRoute({
  method: "get",
  path: "/features",
  tags: ["Platform"],
  summary: "List all platform features",
  responses: {
    200: {
      description: "Feature list",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(FeatureResponseSchema)),
        },
      },
    },
  },
});

export const listFeaturesHandler = async (c: any) => {
  const db = c.get("db");
  const features = await PlatformService.listFeatures(db);
  return c.json({ success: true, data: features }, 200);
};

// --- Templates ---

export const listTemplatesRoute = createRoute({
  method: "get",
  path: "/templates",
  tags: ["Platform"],
  summary: "List industry templates",
  responses: {
    200: {
      description: "Template list",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(IndustryTemplateSchema)),
        },
      },
    },
  },
});

export const listTemplatesHandler = async (c: any) => {
  const db = c.get("db");
  const templates = await PlatformService.listIndustryTemplates(db);
  return c.json({ success: true, data: templates }, 200);
};

// --- Config ---

export const listConfigRoute = createRoute({
  method: "get",
  path: "/config",
  tags: ["Platform"],
  summary: "List platform configuration",
  responses: {
    200: {
      description: "Config list",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(PlatformConfigSchema)),
        },
      },
    },
  },
});

export const listConfigHandler = async (c: any) => {
  const db = c.get("db");
  const config = await PlatformService.listPlatformConfig(db);
  return c.json({ success: true, data: config }, 200);
};

export const setConfigRoute = createRoute({
  method: "put",
  path: "/config",
  tags: ["Platform"],
  summary: "Set platform config key/value",
  request: {
    body: { content: { "application/json": { schema: platformConfigSchema } } },
  },
  responses: {
    200: {
      description: "Config updated",
      content: {
        "application/json": {
          schema: createSuccessSchema(PlatformConfigSchema),
        },
      },
    },
  },
});

export const setConfigHandler = async (c: any) => {
  const db = c.get("db");
  const { key, value } = c.req.valid("json");
  const config = await PlatformService.setPlatformConfig(db, key, value);
  return c.json({ success: true, data: config }, 200);
};
