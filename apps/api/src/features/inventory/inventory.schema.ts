import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  costPrice: z.number().min(0, "Cost price cannot be negative"),
  sellPrice: z.number().min(0, "Sell price cannot be negative"),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const productIdParamSchema = z.object({
  id: z.string().min(1),
});

export const stockInSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  costPerUnit: z.number().min(0, "Cost per unit cannot be negative"),
  note: z.string().optional(),
});

export const stockOutSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  note: z.string().optional(),
});

export const adjustStockSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  newQuantity: z.number().int().min(0, "Quantity cannot be negative"),
  note: z.string().min(1, "Reason is required for adjustment"),
});

export const listProductsQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const branchIdParamSchema = z.object({
  branchId: z.string().min(1),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  costPrice: z.number(),
  sellPrice: z.number(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BranchInventorySchema = z.object({
  id: z.string(),
  branchId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  reorderThreshold: z.number(),
  avgCost: z.number(),
  product: ProductSchema.optional(),
});

export const StockMovementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  branchId: z.string(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "VOID_REVERSAL"]),
  quantity: z.number(),
  costPerUnit: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type StockInInput = z.infer<typeof stockInSchema>;
export type StockOutInput = z.infer<typeof stockOutSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
