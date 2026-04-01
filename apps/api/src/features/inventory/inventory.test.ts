import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProductSchema,
  stockInSchema,
  adjustStockSchema,
  listProductsQuerySchema,
} from "./inventory.schema";
import { InventoryService } from "./inventory.service";
import inventoryApp from "./inventory.index";
import {
  createMockDb,
  signTestJwt,
  mockTenantRolePermissions,
  mountFeatureWithDb,
  testUsers,
} from "../../test/helpers";
import { invalidateAllPermissionCaches } from "../../middlewares/rbac";

describe("inventory.schema", () => {
  it("createProduct requires name and sku", () => {
    expect(createProductSchema.safeParse({ name: "", sku: "", costPrice: 0, sellPrice: 0 }).success).toBe(
      false,
    );
    expect(
      createProductSchema.safeParse({
        name: "Shampoo",
        sku: "SKU-1",
        costPrice: 1,
        sellPrice: 2,
      }).success,
    ).toBe(true);
  });

  it("stockIn requires positive integer quantity", () => {
    expect(
      stockInSchema.safeParse({
        branchId: "b1",
        productId: "p1",
        quantity: 0,
        costPerUnit: 1,
      }).success,
    ).toBe(false);
    expect(
      stockInSchema.safeParse({
        branchId: "b1",
        productId: "p1",
        quantity: 2,
        costPerUnit: 1,
      }).success,
    ).toBe(true);
  });

  it("adjustStock requires note", () => {
    expect(
      adjustStockSchema.safeParse({
        branchId: "b1",
        productId: "p1",
        newQuantity: 0,
        note: "",
      }).success,
    ).toBe(false);
  });

  it("listProductsQuery defaults page and limit", () => {
    const q = listProductsQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
  });
});

describe("InventoryService", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("getProductById throws when missing", async () => {
    (db.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(InventoryService.getProductById(db, "x")).rejects.toThrow("Product not found");
  });

  it("recordStockOut throws when branch inventory missing", async () => {
    (db.branchInventory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      InventoryService.recordStockOut(db, "b1", "p1", "org-1", 1),
    ).rejects.toThrow("Branch inventory not found");
  });

  it("recordStockOut throws when insufficient stock", async () => {
    (db.branchInventory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bi1",
      quantity: 1,
      reorderThreshold: 5,
      product: { name: "P" },
    });
    await expect(
      InventoryService.recordStockOut(db, "b1", "p1", "org-1", 5),
    ).rejects.toThrow("Insufficient stock");
  });

  it("getValuation sums quantity * avgCost", async () => {
    (db.branchInventory.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { quantity: 2, avgCost: 10 },
      { quantity: 1, avgCost: 5 },
    ]);
    const v = await InventoryService.getValuation(db, "b1");
    expect(v).toBe(25);
  });
});

describe("inventory HTTP", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    invalidateAllPermissionCaches();
    mockTenantRolePermissions(db, [
      { featureCode: "INVENTORY", canRead: true, canCreate: true, canUpdate: true },
    ]);
  });

  it("returns 401 without auth for products list", async () => {
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/products", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 403 without INVENTORY read", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: testUsers.customer.userId,
      organizationId: testUsers.customer.organizationId,
      tenantRoleId: testUsers.customer.tenantRoleId,
      scope: testUsers.customer.scope,
      isCustomer: true,
    });
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/products", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when product not found", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/products/p1", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when SKU duplicate on create", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.product.create as ReturnType<typeof vi.fn>).mockRejectedValue({ code: "P2002" });
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "N",
        sku: "SKU",
        costPrice: 1,
        sellPrice: 2,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 400 on insufficient stock-out", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db),
    );
    vi.spyOn(InventoryService, "recordStockOut").mockRejectedValue(new Error("Insufficient stock"));
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/stock-out", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branchId: "b1",
        productId: "p1",
        quantity: 99,
      }),
    });
    expect(res.status).toBe(400);
    vi.restoreAllMocks();
  });

  it("GET /branches/:branchId/movements returns 200 with movements", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    const mockMovements = [
      {
        id: "mov-1",
        productId: "p1",
        branchId: "b1",
        organizationId: "org-1",
        type: "IN",
        quantity: 10,
        costPerUnit: 5000,
        note: null,
        createdAt: new Date(),
        product: { name: "Shampoo", sku: "SHP-001" },
      },
    ];
    (db.stockMovement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMovements);
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/branches/b1/movements?limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("GET /branches/:branchId/movements?productId filters by product", async () => {
    const token = await signTestJwt({
      sub: testUsers.branchManager.userId,
      organizationId: testUsers.branchManager.organizationId,
      tenantRoleId: testUsers.branchManager.tenantRoleId,
      branchId: testUsers.branchManager.branchId,
      scope: testUsers.branchManager.scope,
    });
    vi.spyOn(InventoryService, "getStockMovements").mockResolvedValue([]);
    const app = mountFeatureWithDb(inventoryApp, db);
    const res = await app.request("http://t/branches/b1/movements?productId=p1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(InventoryService.getStockMovements).toHaveBeenCalledWith(expect.anything(), "p1", "b1", 50);
    vi.restoreAllMocks();
  });
});
