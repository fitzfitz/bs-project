# API: Inventory

## Overview

Organization-scoped **product catalog** and **per-branch stock**: CRUD for `Product`, read/write `BranchInventory`, **stock movements** (`IN`, `OUT`, `ADJUSTMENT`; `VOID_REVERSAL` exists in service for transaction voids but has no dedicated public route). Supports **low-stock alerts** (quantity ≤ reorder threshold), **branch valuation** (sum of `quantity × avgCost`), and **weighted average cost** updates on stock-in. List products can optionally include branch-specific inventory rows for one branch.

## API Endpoints

Base path: `/api/inventory` (mounted from `inventory.index.ts`). All routes use `Authorization: Bearer <tenant JWT>` and `X-Org-Slug` with `authMiddleware` and `orgScopeMiddleware`. Permissions differ by route group (see RBAC).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | Paginated products; optional `branchId` adds `inventory` for that branch on each product. |
| POST | `/products` | Create product for current organization (`organizationId` from JWT). |
| GET | `/products/{id}` | Get product by id. |
| PATCH | `/products/{id}` | Partial update. |
| DELETE | `/products/{id}` | Delete product. |
| GET | `/branches/{branchId}` | All `BranchInventory` rows for branch with nested `product`. |
| GET | `/branches/{branchId}/alerts` | Subset where `quantity <= reorderThreshold`. |
| GET | `/branches/{branchId}/valuation` | `{ valuation }` total IDR (sum of qty × avg cost). |
| GET | `/branches/{branchId}/movements` | Stock movement history for branch; optional `productId` filter and `limit` (default 50). |
| POST | `/stock-in` | Receive stock; upserts branch row, updates weighted avg cost, writes `IN` movement. |
| POST | `/stock-out` | Remove stock; writes `OUT` movement; may return `LOW_STOCK` warning. |
| POST | `/adjust` | Set absolute quantity; writes `ADJUSTMENT` movement (quantity = absolute delta). |

### Query / body (summary)

- **`GET /products`**: `branchId` (optional), `isActive` (`"true"` \| `"false"`), `page` (default 1), `limit` (default 20, max 100).
- **`POST /products`**: `name`, `sku`, optional `description`, `costPrice`, `sellPrice`, optional `imageUrl`, `isActive` (default true).
- **`PATCH /products/{id}`**: partial of create shape.
- **`POST /stock-in`**: `branchId`, `productId`, `quantity` (int ≥ 1), `costPerUnit` (≥ 0), optional `note`.
- **`POST /stock-out`**: `branchId`, `productId`, `quantity` (int ≥ 1), optional `note`.
- **`POST /adjust`**: `branchId`, `productId`, `newQuantity` (int ≥ 0), `note` (required string — reason).

Responses use the standard envelope `{ success, data?, message?, pagination? }` with ISO string dates on products where handlers map `Date` fields.

## Business Rules

- **Create product**: Persists under JWT `organizationId`. **SKU** must be unique; duplicate → **409** `SKU already exists` (Prisma `P2002`).
- **List products**: Filters only `isActive` when query provided; does not implicitly exclude other orgs (relying on org-scoped DB client). Optional `branchId` includes matching `inventory` rows only for that branch.
- **Stock-in**: `newAvgCost = ((oldQty × oldAvg) + (inQty × costPerUnit)) / (oldQty + inQty)`; if no prior row, creates `BranchInventory` with default `reorderThreshold: 5`. Transaction timeout 30s.
- **Stock-out**: Rejects if `inv.quantity < quantity` → **400** `Insufficient stock`. Does not change `avgCost`. If new quantity ≤ `reorderThreshold`, response includes `warning: "LOW_STOCK"`, `product` name, `remaining`.
- **Adjust**: Requires existing branch inventory row; sets quantity to `newQuantity`; movement `quantity` is `Math.abs(delta)` with type `ADJUSTMENT`.
- **Delete / update product**: Missing id → **404** (`P2025` or explicit not found on get).

## Scenarios

### Success

- **GIVEN** `INVENTORY` read **WHEN** GET `/products` **THEN** `200` with paginated `Product` DTOs.
- **GIVEN** `INVENTORY` read and valid id **WHEN** GET `/products/{id}` **THEN** `200` with product.
- **GIVEN** `INVENTORY` create permission **WHEN** POST `/products` with unique SKU **THEN** `201` with created product.
- **GIVEN** `INVENTORY` create permission **WHEN** PATCH `/products/{id}` **THEN** `200` with updated product.
- **GIVEN** `INVENTORY` create permission **WHEN** DELETE `/products/{id}` **THEN** `200` with deleted product.
- **GIVEN** `INVENTORY` read **WHEN** GET `/branches/{branchId}` **THEN** `200` with array of branch inventory lines + products.
- **GIVEN** `INVENTORY` read **WHEN** GET `/branches/{branchId}/alerts` **THEN** `200` with low-stock lines only.
- **GIVEN** `INVENTORY` read **WHEN** GET `/branches/{branchId}/valuation` **THEN** `200` with `{ valuation: number }`.
- **GIVEN** `INVENTORY` update **WHEN** POST `/stock-in` with valid branch/product **THEN** `200` with `{ quantity, avgCost }`.
- **GIVEN** `INVENTORY` update and sufficient stock **WHEN** POST `/stock-out` **THEN** `200`; optional `LOW_STOCK` fields when below threshold.
- **GIVEN** `INVENTORY` update **WHEN** POST `/adjust` with valid row **THEN** `200` with `{ quantity }`.

### Failure

- **GIVEN** missing auth or wrong permission **WHEN** any route **THEN** `401` / `403` (middleware).
- **GIVEN** duplicate SKU on create **WHEN** POST `/products` **THEN** `409`.
- **GIVEN** unknown product id **WHEN** GET `/products/{id}` **THEN** `404`.
- **GIVEN** insufficient quantity **WHEN** POST `/stock-out` **THEN** `400` `Insufficient stock`.
- **GIVEN** missing branch inventory **WHEN** POST `/stock-out` or `/adjust` **THEN** `404` with message containing not found.

## Edge Cases

- **Product mutations vs org**: Handlers use `organizationId` from JWT on create/stock flows; ensure org-scoped Prisma prevents cross-tenant reads/writes on ids.
- **Reorder threshold**: New branch inventory from stock-in always uses `reorderThreshold: 5` unless changed elsewhere (no API in this feature to edit threshold).
- **`getStockMovements`**: Implemented on service but **no** HTTP route in `inventory.handlers.ts`.
- **Concurrent stock**: Stock-out handler wraps `recordStockOut` in `$transaction` from the handler; stock-in/adjust use service transactions with 30s timeout.
- **OpenAPI vs runtime**: Some routes omit explicit `security: bearerAuth` in route defs; protection is enforced by the Hono sub-routers.

## RBAC

- **Feature**: `INVENTORY`
- **Actions** (as wired in `inventory.index.ts`):
  - **`read`**: `GET /products`, `GET /products/{id}`, `GET /branches/{branchId}`, `GET .../alerts`, `GET .../valuation`
  - **`update`**: `POST /stock-in`, `POST /stock-out`, `POST /adjust`
  - **`create`**: `POST /products`, `PATCH /products/{id}`, `DELETE /products/{id}` (product write/delete require `create`, not `update`/`delete`)

## Dependencies

- **Middleware**: `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Prisma models**: `Product`, `BranchInventory`, `StockMovement`
- **Other features**: `InventoryService.recordStockOut` / `recordVoidReversal` are used from **transactions** service for POS flows (not duplicated here).
