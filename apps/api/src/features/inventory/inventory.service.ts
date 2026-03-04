import type { PrismaClient } from "@prisma/client";
import type {
  CreateProductInput,
  UpdateProductInput,
  StockInInput,
  StockOutInput,
  AdjustStockInput,
  ListProductsQuery,
} from "./inventory.schema";

export const InventoryService = {
  async createProduct(db: PrismaClient, organizationId: string, data: CreateProductInput) {
    return db.product.create({
      data: {
        organizationId,
        name: data.name,
        sku: data.sku,
        description: data.description ?? null,
        costPrice: data.costPrice,
        sellPrice: data.sellPrice,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
      },
    });
  },

  async updateProduct(db: PrismaClient, id: string, data: UpdateProductInput) {
    return db.product.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.sku != null && { sku: data.sku }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.costPrice != null && { costPrice: data.costPrice }),
        ...(data.sellPrice != null && { sellPrice: data.sellPrice }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  async getProductById(db: PrismaClient, id: string) {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) throw new Error("Product not found");
    return product;
  },

  async listProducts(db: PrismaClient, query: ListProductsQuery) {
    const where: { isActive?: boolean } = {};
    if (query.isActive !== undefined) where.isActive = query.isActive === "true";

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { name: "asc" },
        include:
          query.branchId
            ? { inventory: { where: { branchId: query.branchId } } }
            : undefined,
      }),
      db.product.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },

  async deleteProduct(db: PrismaClient, id: string) {
    return db.product.delete({ where: { id } });
  },

  /**
   * Weighted average cost: newAvgCost = ((qty * avgCost) + (inQty * costPerUnit)) / (qty + inQty)
   */
  async recordStockIn(db: PrismaClient, organizationId: string, data: StockInInput) {
    return db.$transaction(async (tx) => {
      const inv = await tx.branchInventory.findUnique({
        where: {
          branchId_productId: { branchId: data.branchId, productId: data.productId },
        },
      });
      let quantity: number;
      let avgCost: number;
      if (!inv) {
        quantity = data.quantity;
        avgCost = data.costPerUnit;
        await tx.branchInventory.create({
          data: {
            branchId: data.branchId,
            productId: data.productId,
            organizationId,
            quantity,
            avgCost,
            reorderThreshold: 5,
          },
        });
      } else {
        const totalCost = inv.quantity * inv.avgCost + data.quantity * data.costPerUnit;
        quantity = inv.quantity + data.quantity;
        avgCost = quantity > 0 ? totalCost / quantity : data.costPerUnit;
        await tx.branchInventory.update({
          where: { id: inv.id },
          data: { quantity, avgCost },
        });
      }
      await tx.stockMovement.create({
        data: {
          productId: data.productId,
          branchId: data.branchId,
          organizationId,
          type: "IN",
          quantity: data.quantity,
          costPerUnit: data.costPerUnit,
          note: data.note ?? null,
        },
      });
      return { quantity, avgCost };
    });
  },

  /**
   * Decrease quantity; create OUT movement. Returns low-stock warning if remaining <= reorderThreshold.
   * Can be called with transaction client from addPayments.
   */
  async recordStockOut(
    db: Pick<PrismaClient, "branchInventory" | "stockMovement">,
    branchId: string,
    productId: string,
    organizationId: string,
    quantity: number,
    note?: string
  ): Promise<{ warning?: "LOW_STOCK"; product?: string; remaining?: number }> {
    const inv = await db.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
      include: { product: true },
    });
    if (!inv) throw new Error("Branch inventory not found");
    if (inv.quantity < quantity) throw new Error("Insufficient stock");

    const newQuantity = inv.quantity - quantity;
    await db.branchInventory.update({
      where: { id: inv.id },
      data: { quantity: newQuantity },
    });
    await db.stockMovement.create({
      data: {
        productId,
        branchId,
        organizationId,
        type: "OUT",
        quantity,
        note: note ?? null,
      },
    });
    const result: { warning?: "LOW_STOCK"; product?: string; remaining?: number } = {};
    if (newQuantity <= inv.reorderThreshold) {
      result.warning = "LOW_STOCK";
      result.product = inv.product.name;
      result.remaining = newQuantity;
    }
    return result;
  },

  /**
   * Set quantity to newQuantity; log ADJUSTMENT movement. Used for corrections.
   */
  async adjustStock(db: PrismaClient, organizationId: string, data: AdjustStockInput) {
    return db.$transaction(async (tx) => {
      const inv = await tx.branchInventory.findUnique({
        where: {
          branchId_productId: { branchId: data.branchId, productId: data.productId },
        },
      });
      if (!inv) throw new Error("Branch inventory not found");
      const delta = data.newQuantity - inv.quantity;
      await tx.branchInventory.update({
        where: { id: inv.id },
        data: { quantity: data.newQuantity },
      });
      await tx.stockMovement.create({
        data: {
          productId: data.productId,
          branchId: data.branchId,
          organizationId,
          type: "ADJUSTMENT",
          quantity: Math.abs(delta),
          note: data.note,
        },
      });
      return { quantity: data.newQuantity };
    });
  },

  /**
   * Void reversal: increase stock and log VOID_REVERSAL movement. Call with tx from voidTransaction.
   */
  async recordVoidReversal(
    db: Pick<PrismaClient, "branchInventory" | "stockMovement">,
    branchId: string,
    productId: string,
    organizationId: string,
    quantity: number,
    note?: string
  ) {
    const inv = await db.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    if (!inv) {
      await db.branchInventory.create({
        data: {
          branchId,
          productId,
          organizationId,
          quantity,
          avgCost: 0,
          reorderThreshold: 5,
        },
      });
    } else {
      await db.branchInventory.update({
        where: { id: inv.id },
        data: { quantity: inv.quantity + quantity },
      });
    }
    await db.stockMovement.create({
      data: {
        productId,
        branchId,
        organizationId,
        type: "VOID_REVERSAL",
        quantity,
        note: note ?? null,
      },
    });
  },

  async getLowStockAlerts(db: PrismaClient, branchId: string) {
    const rows = await db.branchInventory.findMany({
      where: { branchId },
      include: { product: true },
    });
    return rows.filter((r) => r.quantity <= r.reorderThreshold);
  },

  async getBranchInventory(db: PrismaClient, branchId: string) {
    return db.branchInventory.findMany({
      where: { branchId },
      include: { product: true },
    });
  },

  async getValuation(db: PrismaClient, branchId: string): Promise<number> {
    const rows = await db.branchInventory.findMany({
      where: { branchId },
      select: { quantity: true, avgCost: true },
    });
    return rows.reduce((sum, r) => sum + r.quantity * r.avgCost, 0);
  },

  async getStockMovements(
    db: PrismaClient,
    productId: string,
    branchId: string,
    limit = 50
  ) {
    return db.stockMovement.findMany({
      where: { productId, branchId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { product: { select: { name: true, sku: true } } },
    });
  },
};
