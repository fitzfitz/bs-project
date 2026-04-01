# Feature: Admin Inventory Management

## Overview

The inventory feature allows admin users to view branch-level product inventory and perform stock operations (stock in, stock out, adjust). It provides a table view of all inventory items with low-stock indicators and a modal dialog for executing stock actions. The feature integrates with the products catalog and supports per-branch inventory tracking.

## Components

### InventoryManager (Widget)
- Accepts `branchId` prop
- Displays a table of inventory items for the selected branch with columns: Product, SKU, Qty, Threshold, Status, Actions
- Status column shows "Low Stock" (red) when `quantity <= reorderThreshold`, otherwise "OK" (green)
- Each row has 3 action buttons: "+In" (stock in), "-Out" (stock out), "Adjust"
- Empty state: "No inventory items found" when no items exist
- Loading state: "Loading..." text
- Error state: displays error message in destructive color
- Shows "No branch selected." when `branchId` is empty

### StockActionDialog (Internal Component)
- Modal overlay dialog for performing a stock action
- Shows product name and current quantity
- Fields vary by action type:
  - **Stock In**: Quantity + Cost Per Unit + optional Note
  - **Stock Out**: Quantity + optional Note
  - **Adjust**: New Quantity + required Note
- Confirm button disabled when: `quantity <= 0` or (adjust type and note is empty)
- Shows "Saving..." during mutation, displays mutation errors
- Closes on successful mutation

## Hooks

| Hook | Method | Endpoint | Query Key |
|------|--------|----------|-----------|
| `useBranchInventory(branchId)` | GET | `/inventory/branches/:branchId` | `["inventory", "branch", branchId]` |
| `useProducts(branchId?, options?)` | GET | `/inventory/products` (optional `branchId`, `limit`, `page`) | `["inventory", "products", branchId, limit, page]` |
| `useCreateProduct()` | POST | `/inventory/products` | Mutation; invalidates `["inventory"]` |
| `useUpdateProduct()` | PATCH | `/inventory/products/:id` | Mutation; invalidates `["inventory"]` |
| `useDeleteProduct()` | DELETE | `/inventory/products/:id` | Mutation; invalidates `["inventory"]` |
| `useStockIn()` | POST | `/inventory/stock-in` | Mutation, invalidates `["inventory"]` |
| `useStockOut()` | POST | `/inventory/stock-out` | Mutation, invalidates `["inventory"]` |
| `useAdjustStock()` | POST | `/inventory/adjust` | Mutation, invalidates `["inventory"]` |

## State

- No dedicated Zustand store — uses `useBranchStore.selectedBranchId` from the page level
- Local React state for `stockAction` (which modal dialog is open and for which product)
- Local state inside `StockActionDialog` for form fields: `quantity`, `costPerUnit`, `note`

## Business Rules

1. `useBranchInventory` is disabled when `branchId` is empty/falsy.
2. Low stock indicator triggers when `quantity <= reorderThreshold`.
3. Stock In requires: `branchId`, `productId`, `quantity`, `costPerUnit`, and optional `note`.
4. Stock Out requires: `branchId`, `productId`, `quantity`, and optional `note`.
5. Adjust requires: `branchId`, `productId`, `newQuantity`, and a **required** `note` (reason for adjustment).
6. All three stock mutations invalidate the entire `["inventory"]` query family on success.
7. Confirm button is disabled when quantity is 0 or less, or when adjusting without a note.
8. Product name falls back to `productId` if `product.name` is not available.
9. SKU falls back to "—" if `product.sku` is not available.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/inventory/page.tsx` | Tabs: `branchId` into `InventoryManager`; `ProductManager` on Products tab. |
| `widgets/inventory-manager.tsx` | `useBranchInventory`, `useStockIn`, `useStockOut`, `useAdjustStock`. |
| `widgets/product-manager.tsx` | `useProducts(undefined, { limit: 100, page: 1 })`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`. |
| `features/pos/widgets/pos-checkout.tsx` | `useProducts(branchId)` — catalog with stock (not used inside `InventoryManager`). |

## Hook States

### Query hooks (`useBranchInventory`)

- **Loading:** GIVEN truthy `branchId` WHEN GET `/inventory/branches/:id` fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` contains message (table shows destructive text).
- **Disabled:** GIVEN falsy `branchId` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `data` is `BranchInventoryItem[]` envelope.

### Query hooks (`useProducts`)

- **Loading:** GIVEN hook mounted WHEN `/inventory/products` fetching THEN `isLoading: true`.
- **Error:** GIVEN API failure WHEN settled THEN `isError: true`.
- **Disabled:** GIVEN N/A (optional `branchId` only changes URL) WHEN mounted THEN request runs.
- **Success:** GIVEN success THEN `data` includes `items` / pagination for product list.

### Mutation hooks (`useStockIn`, `useStockOut`, `useAdjustStock`)

- **Pending:** GIVEN confirm in dialog WHEN POST in flight THEN `isPending: true` (“Saving…”).
- **Error:** GIVEN API rejects WHEN mutation fails THEN `isError: true`, error shown in dialog.
- **Success:** GIVEN success WHEN mutation resolves THEN **`["inventory"]`** query family invalidates (branch table refetches).

## Scenarios

### Scenario: View branch inventory

- **GIVEN** a branch is selected with inventory items
- **WHEN** `InventoryManager` renders
- **THEN** a table shows all items with product name, SKU, quantity, threshold, status, and action buttons

### Scenario: Low stock indicator

- **GIVEN** an inventory item has `quantity <= reorderThreshold`
- **WHEN** the table renders
- **THEN** the status column shows a red "Low Stock" badge

### Scenario: Stock in action

- **GIVEN** a user clicks "+In" on an inventory row
- **WHEN** the Stock In dialog opens
- **THEN** fields for Quantity, Cost Per Unit, and Note are shown
- **AND WHEN** the user fills quantity=10, costPerUnit=5000 and clicks Confirm
- **THEN** `POST /inventory/stock-in` is called and inventory queries are invalidated

### Scenario: Stock out action

- **GIVEN** a user clicks "-Out" on an inventory row
- **WHEN** the Stock Out dialog opens
- **THEN** fields for Quantity and Note are shown (no Cost Per Unit)
- **AND WHEN** the user fills quantity=5 and clicks Confirm
- **THEN** `POST /inventory/stock-out` is called and inventory queries are invalidated

### Scenario: Adjust stock action

- **GIVEN** a user clicks "Adjust" on an inventory row
- **WHEN** the Adjust dialog opens
- **THEN** fields for New Quantity and Note (required) are shown
- **AND** the Confirm button is disabled until note is provided

### Scenario: Stock action error

- **GIVEN** a stock mutation returns an error
- **WHEN** the error occurs
- **THEN** the error message is displayed in the dialog below the form fields

### Scenario: Empty inventory

- **GIVEN** a branch has no inventory items
- **WHEN** `InventoryManager` renders
- **THEN** a "No inventory items found" message is shown in the table

### Scenario: No branch selected

- **GIVEN** `branchId` prop is empty
- **WHEN** `InventoryManager` renders
- **THEN** "No branch selected." message is displayed

## Edge Cases

- Product without `product` relation → falls back to showing `productId` and "—" for SKU
- All items at or below reorder threshold → all show "Low Stock"
- Zero quantity items → still shown in table (not filtered out)
- Mutation succeeds but dialog state reset → form fields reset via component unmount (dialog closes)
- Concurrent stock actions → each mutation independently invalidates queries

## RBAC

- Inventory management is typically gated at the page/route level by `RequirePermission`
- The feature itself does not check permissions internally

## Product catalog CRUD (ProductManager)

### ProductManager (Widget)

- Lists organization products in a data table: Name, SKU, Cost (IDR), Sell (IDR), Status (Active/Inactive badge), Actions (edit, delete).
- **Create:** "Create product" opens a dialog with react-hook-form + Zod: name, SKU, cost (IDR), sell (IDR), description (optional textarea), Active switch. Submit calls `POST /inventory/products` with `{ name, sku, costPrice, sellPrice, description?, isActive? }`. Closes on success; shows API error in the dialog on failure.
- **Edit:** Row click, keyboard (Enter/Space on focused row), or Edit button opens the same dialog prefilled. Submit calls `PATCH /inventory/products/:id` with partial-safe body (same fields as create). Closes on success.
- **Delete:** Trash action opens a confirmation dialog; confirm calls `DELETE /inventory/products/:id`. Closes on success.
- **Loading:** "Loading products…" while the list query is fetching.
- **Error:** List fetch errors show destructive message text.
- **Empty:** "No products yet. Create one to get started." when the list is empty.
- Uses `useProducts(undefined, { limit: 100, page: 1 })` for catalog-wide listing (paginated API; first page up to 100 items).

### Product mutation hooks

| Hook | Method | Endpoint | Invalidation |
|------|--------|----------|--------------|
| `useCreateProduct()` | POST | `/inventory/products` | `["inventory"]` on success |
| `useUpdateProduct()` | PATCH | `/inventory/products/:id` | `["inventory"]` on success |
| `useDeleteProduct()` | DELETE | `/inventory/products/:id` | `["inventory"]` on success |

### Inventory page tabs

- `pages/inventory/page.tsx` renders **Stock** and **Products** tabs (Shadcn Tabs + local state). **Stock** shows existing `InventoryManager` with selected `branchId`. **Products** shows `ProductManager` (no branch filter on the catalog list).

### Scenarios (products)

- **GIVEN** products exist **WHEN** ProductManager renders **THEN** the table shows name, SKU, formatted IDR prices, and Active/Inactive badges.
- **GIVEN** the user opens Create and submits valid data **WHEN** POST succeeds **THEN** the dialog closes and inventory queries refetch.
- **GIVEN** the user edits a product **WHEN** PATCH succeeds **THEN** the dialog closes and the list updates.
- **GIVEN** the user confirms delete **WHEN** DELETE succeeds **THEN** the confirmation closes and the list updates.

## Dependencies

- `@/features/inventory/api/use-branch-inventory` — branch inventory data
- `@/features/inventory/api/use-stock-actions` — stock in/out/adjust mutations
- `@/features/inventory/api/use-products` — products catalog (POS, ProductManager)
- `@/features/inventory/api/use-product-crud` — create/update/delete product mutations
- `@/store/use-branch-store` — branch selection (at page level)
