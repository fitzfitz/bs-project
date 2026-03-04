import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { InventoryService } from "./inventory.service";
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  stockInSchema,
  stockOutSchema,
  adjustStockSchema,
  listProductsQuerySchema,
  branchIdParamSchema,
  ProductSchema,
  BranchInventorySchema,
} from "./inventory.schema";
import { createSuccessSchema, createPaginatedSuccessSchema } from "../../utils/openapi";

export const listProductsRoute = createRoute({
  method: "get",
  path: "/products",
  tags: ["Inventory"],
  summary: "List products",
  request: { query: listProductsQuerySchema },
  responses: {
    200: {
      description: "Paginated products",
      content: {
        "application/json": {
          schema: createPaginatedSuccessSchema(ProductSchema),
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const createProductRoute = createRoute({
  method: "post",
  path: "/products",
  tags: ["Inventory"],
  summary: "Create product",
  request: { body: { content: { "application/json": { schema: createProductSchema } } } },
  responses: {
    201: {
      description: "Product created",
      content: { "application/json": { schema: createSuccessSchema(ProductSchema) } },
    },
    400: { description: "Validation error" },
    409: { description: "SKU already exists" },
    500: { description: "Internal server error" },
  },
});

export const getProductRoute = createRoute({
  method: "get",
  path: "/products/{id}",
  tags: ["Inventory"],
  summary: "Get product by ID",
  request: { params: productIdParamSchema },
  responses: {
    200: {
      description: "Product",
      content: { "application/json": { schema: createSuccessSchema(ProductSchema) } },
    },
    404: { description: "Product not found" },
    500: { description: "Internal server error" },
  },
});

export const updateProductRoute = createRoute({
  method: "patch",
  path: "/products/{id}",
  tags: ["Inventory"],
  summary: "Update product",
  request: {
    params: productIdParamSchema,
    body: { content: { "application/json": { schema: updateProductSchema } } },
  },
  responses: {
    200: {
      description: "Product updated",
      content: { "application/json": { schema: createSuccessSchema(ProductSchema) } },
    },
    404: { description: "Product not found" },
    409: { description: "SKU already exists" },
    500: { description: "Internal server error" },
  },
});

export const deleteProductRoute = createRoute({
  method: "delete",
  path: "/products/{id}",
  tags: ["Inventory"],
  summary: "Delete product",
  request: { params: productIdParamSchema },
  responses: {
    200: {
      description: "Product deleted",
      content: { "application/json": { schema: createSuccessSchema(ProductSchema) } },
    },
    404: { description: "Product not found" },
    500: { description: "Internal server error" },
  },
});

export const getBranchInventoryRoute = createRoute({
  method: "get",
  path: "/branches/{branchId}",
  tags: ["Inventory"],
  summary: "Get branch inventory",
  request: { params: branchIdParamSchema },
  responses: {
    200: {
      description: "Branch inventory",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(BranchInventorySchema)),
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const getLowStockAlertsRoute = createRoute({
  method: "get",
  path: "/branches/{branchId}/alerts",
  tags: ["Inventory"],
  summary: "Get low-stock alerts",
  request: { params: branchIdParamSchema },
  responses: {
    200: {
      description: "Low-stock items",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(BranchInventorySchema)),
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const getValuationRoute = createRoute({
  method: "get",
  path: "/branches/{branchId}/valuation",
  tags: ["Inventory"],
  summary: "Get branch inventory valuation",
  request: { params: branchIdParamSchema },
  responses: {
    200: {
      description: "Total valuation (IDR)",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ valuation: z.number() }),
          }),
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const stockInRoute = createRoute({
  method: "post",
  path: "/stock-in",
  tags: ["Inventory"],
  summary: "Record stock in",
  request: { body: { content: { "application/json": { schema: stockInSchema } } } },
  responses: {
    200: {
      description: "Stock recorded",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ quantity: z.number(), avgCost: z.number() }),
          }),
        },
      },
    },
    400: { description: "Validation error" },
    404: { description: "Product or branch not found" },
    500: { description: "Internal server error" },
  },
});

export const stockOutRoute = createRoute({
  method: "post",
  path: "/stock-out",
  tags: ["Inventory"],
  summary: "Record stock out",
  request: { body: { content: { "application/json": { schema: stockOutSchema } } } },
  responses: {
    200: {
      description: "Stock recorded",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              warning: z.enum(["LOW_STOCK"]).optional(),
              product: z.string().optional(),
              remaining: z.number().optional(),
            }),
          }),
        },
      },
    },
    400: { description: "Insufficient stock" },
    404: { description: "Branch inventory not found" },
    500: { description: "Internal server error" },
  },
});

export const adjustStockRoute = createRoute({
  method: "post",
  path: "/adjust",
  tags: ["Inventory"],
  summary: "Adjust stock quantity",
  request: { body: { content: { "application/json": { schema: adjustStockSchema } } } },
  responses: {
    200: {
      description: "Stock adjusted",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ quantity: z.number() }),
          }),
        },
      },
    },
    404: { description: "Branch inventory not found" },
    500: { description: "Internal server error" },
  },
});

export const listProductsHandler: RouteHandler<typeof listProductsRoute, AppEnv> = async (c) => {
  try {
    const query = c.req.valid("query");
    const result = await InventoryService.listProducts(c.var.db, query);
    const data = result.items.map((p) => ({
      ...p,
      description: p.description ?? null,
      imageUrl: p.imageUrl ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
    return c.json(
      {
        success: true as const,
        data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
      200
    );
  } catch (err) {
    console.error("List products:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const createProductHandler: RouteHandler<typeof createProductRoute, AppEnv> = async (c) => {
  try {
    const data = c.req.valid("json");
    const organizationId = c.get("organizationId")!;
    const product = await InventoryService.createProduct(c.var.db, organizationId, data);
    return c.json(
      {
        success: true as const,
        data: {
          ...product,
          description: product.description ?? null,
          imageUrl: product.imageUrl ?? null,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
        },
      },
      201
    );
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002")
      return c.json({ success: false, message: "SKU already exists" }, 409);
    console.error("Create product:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getProductHandler: RouteHandler<typeof getProductRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await InventoryService.getProductById(c.var.db, id);
    return c.json({
      success: true as const,
      data: {
        ...product,
        description: product.description ?? null,
        imageUrl: product.imageUrl ?? null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    }, 200);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Product not found")
      return c.json({ success: false, message: "Product not found" }, 404);
    console.error("Get product:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const updateProductHandler: RouteHandler<typeof updateProductRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const product = await InventoryService.updateProduct(c.var.db, id, data);
    return c.json({
      success: true as const,
      data: {
        ...product,
        description: product.description ?? null,
        imageUrl: product.imageUrl ?? null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    }, 200);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025")
      return c.json({ success: false, message: "Product not found" }, 404);
    if (err && typeof err === "object" && "code" in err && err.code === "P2002")
      return c.json({ success: false, message: "SKU already exists" }, 409);
    console.error("Update product:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const deleteProductHandler: RouteHandler<typeof deleteProductRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await InventoryService.deleteProduct(c.var.db, id);
    return c.json({
      success: true as const,
      data: {
        ...product,
        description: product.description ?? null,
        imageUrl: product.imageUrl ?? null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    }, 200);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025")
      return c.json({ success: false, message: "Product not found" }, 404);
    console.error("Delete product:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getBranchInventoryHandler: RouteHandler<
  typeof getBranchInventoryRoute,
  AppEnv
> = async (c) => {
  try {
    const branchId = c.req.param("branchId");
    const rows = await InventoryService.getBranchInventory(c.var.db, branchId);
    const data = rows.map((r) => ({
      ...r,
      product: {
        ...r.product,
        description: r.product.description ?? null,
        imageUrl: r.product.imageUrl ?? null,
        createdAt: r.product.createdAt.toISOString(),
        updatedAt: r.product.updatedAt.toISOString(),
      },
    }));
    return c.json({ success: true as const, data }, 200);
  } catch (err) {
    console.error("Get branch inventory:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getLowStockAlertsHandler: RouteHandler<
  typeof getLowStockAlertsRoute,
  AppEnv
> = async (c) => {
  try {
    const branchId = c.req.param("branchId");
    const rows = await InventoryService.getLowStockAlerts(c.var.db, branchId);
    const data = rows.map((r) => ({
      ...r,
      product: {
        ...r.product,
        description: r.product.description ?? null,
        imageUrl: r.product.imageUrl ?? null,
        createdAt: r.product.createdAt.toISOString(),
        updatedAt: r.product.updatedAt.toISOString(),
      },
    }));
    return c.json({ success: true as const, data }, 200);
  } catch (err) {
    console.error("Get low stock alerts:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getValuationHandler: RouteHandler<typeof getValuationRoute, AppEnv> = async (c) => {
  try {
    const branchId = c.req.param("branchId");
    const valuation = await InventoryService.getValuation(c.var.db, branchId);
    return c.json({ success: true as const, data: { valuation } }, 200);
  } catch (err) {
    console.error("Get valuation:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const stockInHandler: RouteHandler<typeof stockInRoute, AppEnv> = async (c) => {
  try {
    const organizationId = c.get("organizationId")!;
    const data = c.req.valid("json");
    const result = await InventoryService.recordStockIn(c.var.db, organizationId, data);
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("not found"))
      return c.json({ success: false, message: err.message }, 404);
    console.error("Stock in:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const stockOutHandler: RouteHandler<typeof stockOutRoute, AppEnv> = async (c) => {
  try {
    const organizationId = c.get("organizationId")!;
    const { branchId, productId, quantity, note } = c.req.valid("json");
    const result = await c.var.db.$transaction((tx) =>
      InventoryService.recordStockOut(tx, branchId, productId, organizationId!, quantity, note)
    );
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes("not found"))
        return c.json({ success: false, message: err.message }, 404);
      if (err.message === "Insufficient stock")
        return c.json({ success: false, message: err.message }, 400);
    }
    console.error("Stock out:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const adjustStockHandler: RouteHandler<typeof adjustStockRoute, AppEnv> = async (c) => {
  try {
    const organizationId = c.get("organizationId")!;
    const data = c.req.valid("json");
    const result = await InventoryService.adjustStock(c.var.db, organizationId, data);
    return c.json({ success: true as const, data: result }, 200);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("not found"))
      return c.json({ success: false, message: err.message }, 404);
    console.error("Adjust stock:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};
