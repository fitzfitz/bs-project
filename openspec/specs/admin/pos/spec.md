# Feature: Admin POS (Point of Sale)

## Overview

The POS feature is the primary transaction creation interface in the admin app. It provides a catalog of services and products, a shopping cart with quantity management, order-level discount and tip inputs, payment method selection, and a checkout flow that creates a transaction and records payment. The POS supports offline operation — when the device is offline, transactions are saved locally and automatically synced when connectivity returns.

## Components

### POSCheckout (Main Widget)
- Two-panel layout: Catalog (left, 3/5 width) and Order (right, 2/5 width)
- **Catalog Panel**: Tabbed interface switching between Services and Products
  - Services: Grid of service cards with name and formatted price, click to add to cart
  - Products: Grid of product cards with name, price, and stock count; out-of-stock items are disabled
  - Loading: 6 skeleton placeholder cards
  - Empty products: "No products available" with Package icon
- **Order Panel**: Sticky cart summary
  - Cart items list with name, unit price, quantity controls (+/-), line total, and remove button
  - Empty cart: "Add items to get started" placeholder
  - Summary section: Subtotal, Discount input, Tax (from config `TAX_RATE`, default 12%), Tip input, Grand Total
  - Payment method selector: 4 options (Cash, QRIS, Card, E-Wallet)
  - Checkout button: disabled when cart is empty, no payment method selected, or mutation is pending
- **Completion Screen**: Shows after successful checkout
  - Online: green checkmark, "Payment Complete", transaction ID excerpt, "New Sale" button
  - Offline: amber WiFi-off icon, "Saved for Sync", offline explanation, "New Sale" button

### OfflineBanner
- Renders amber banner "You are offline..." when `navigator.onLine` is false
- Static check at render time (no event listeners)

### SyncIndicator
- Shows "Offline" text when offline, null when online
- Uses `online`/`offline` event listeners with state

## Hooks

| Hook | Method | Endpoint | Key |
|------|--------|----------|-----|
| `useServices()` | GET | `/services?limit=100` | `["services"]` |
| `useBranches()` | GET | `/branches` | `["branches"]` |
| `useProducts(branchId?)` | GET | `/inventory/products?branchId=` | `["inventory", "products", branchId]` |
| `useCreateTransaction()` | POST | `/transactions` | Mutation |
| `useAddPayments()` | POST | `/transactions/:id/pay` | Mutation |
| `useConfig()` | GET | `/config` | (from config feature) |

## State

### Zustand Store: `usePOSStore`
- `cartItems: CartItem[]` — service/product line items
- `discountValue: number` — order-level discount amount
- `tipAmount: number` — tip amount
- `selectedPaymentMethod: PaymentMethod | null` — CASH, CARD, QRIS, or DIGITAL_WALLET
- `queueEntryId: string | null` — optional link to a queue entry

Actions:
- `addItem(item)` — adds item or increments qty if same `serviceId`/`productId` already exists
- `removeItem(index)` — removes by index
- `updateQuantity(index, qty)` — sets qty (minimum 1)
- `setDiscount(value)` / `setTip(amount)` / `setPaymentMethod(method)` / `setQueueEntryId(id)`
- `reset()` — clears all cart state

### Types
- `CartItem`: `{ serviceId?, productId?, name, unitPrice, qty, discount }`
- `PaymentMethod`: `"CASH" | "CARD" | "QRIS" | "DIGITAL_WALLET"`

## Business Rules

1. Cart merges duplicate items by `serviceId` or `productId` — adds to existing qty instead of creating new line.
2. Minimum quantity per item is 1 (enforced by `updateQuantity`).
3. Discount is capped at subtotal: `discountTotal = Math.min(discountValue, subtotal)`.
4. Tax calculation: `tax = (subtotal - discountTotal) * TAX_RATE` where `TAX_RATE` comes from config (`TAX_RATE` setting / 100), defaulting to 12%.
5. Grand total: `subtotal - discountTotal + tax + tipAmount`.
6. Checkout is disabled when: cart is empty, no payment method selected, grand total <= 0, or mutation is pending.
7. Online checkout flow: `POST /transactions` → get `txId` → `POST /transactions/:txId/pay` with single payment for full amount.
8. Offline checkout flow: save via `saveOfflineTransaction()` with `clientUuid` from `crypto.randomUUID()`, status `PENDING_SYNC`.
9. On `online` event, `syncPendingTransactions()` runs with the session access token.
10. Products are filtered to only active ones (`isActive === true`).
11. Products with `inventory[0].quantity <= 0` are shown as "Out" and disabled.
12. After successful checkout (online or offline), the POS store is reset via `reset()`.
13. All monetary values formatted with `id-ID` locale, IDR currency, no decimal places.
14. Auto-selects first branch if none selected.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/pos/page.tsx` | `useQueue` for today’s list / linking; renders `POSCheckout`. |
| `widgets/pos-checkout.tsx` | `useServices`, `useBranches`, `useProducts(branchId)`, `useCreateTransaction`, `useAddPayments`, `useConfig`. |

## Hook States

### Query hooks (`useServices`, `useBranches`, `useProducts`, `useConfig`)

- **Loading:** GIVEN hook mounted WHEN GET in flight THEN `isLoading: true`, catalog shows skeletons where implemented.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, error banner in catalog panel for services/branches/products as wired.
- **Disabled:** GIVEN `useProducts` — always enabled (optional `branchId` in query key/URL only); `useConfig` always enabled.
- **Success:** GIVEN success THEN `data` matches services list, branches list, product list with `items`, or config map for tax rate.

### Mutation hooks (`useCreateTransaction`, `useAddPayments`)

- **Pending:** GIVEN checkout invoked WHEN POST in flight THEN `isPending: true`, checkout shows “Processing…” and stays disabled.
- **Error:** GIVEN create or pay fails WHEN mutation rejects THEN `isError: true`, message under checkout button.
- **Success:** GIVEN `useCreateTransaction` resolves WHEN caller chains `useAddPayments` online THEN payments POST completes; hooks themselves do not invalidate queries (cart reset and completion UI are local/offline flows).

## Scenarios

### Scenario: Add service to cart

- **GIVEN** the POS page is loaded with services
- **WHEN** the user clicks a service card
- **THEN** the service is added to the cart with qty=1
- **AND** the order summary updates

### Scenario: Add duplicate service

- **GIVEN** a service is already in the cart with qty=1
- **WHEN** the user clicks the same service card again
- **THEN** the existing cart item's qty increases to 2

### Scenario: Add product to cart

- **GIVEN** the Products tab is active and products are loaded
- **WHEN** the user clicks an in-stock product card
- **THEN** the product is added to the cart

### Scenario: Out-of-stock product

- **GIVEN** a product has `inventory[0].quantity <= 0`
- **WHEN** the products grid renders
- **THEN** the product card shows "Out" badge and is disabled (cannot be clicked)

### Scenario: Complete online checkout

- **GIVEN** items in cart, payment method selected, device is online
- **WHEN** the user clicks the checkout button
- **THEN** `POST /transactions` is called, then `POST /transactions/:id/pay`
- **AND** the completion screen shows "Payment Complete"
- **AND** the POS store is reset

### Scenario: Complete offline checkout

- **GIVEN** items in cart, payment method selected, device is offline
- **WHEN** the user clicks the checkout button
- **THEN** the transaction is saved via `saveOfflineTransaction()`
- **AND** the completion screen shows "Saved for Sync"
- **AND** the POS store is reset

### Scenario: Auto-sync on reconnect

- **GIVEN** there are pending offline transactions
- **WHEN** the device comes back online
- **THEN** `syncPendingTransactions()` is called with the session access token

### Scenario: Checkout API error

- **GIVEN** the create transaction or add payment API returns an error
- **WHEN** the mutation fails
- **THEN** the error message is shown below the checkout button

### Scenario: Adjust discount and tip

- **GIVEN** items in the cart with a subtotal of 100,000
- **WHEN** the user enters a discount of 20,000 and tip of 10,000
- **THEN** the summary shows: Subtotal 100,000, Discount 20,000, Tax on 80,000, Tip 10,000, Grand Total

### Scenario: Start new sale after completion

- **GIVEN** the completion screen is showing
- **WHEN** the user clicks "New Sale"
- **THEN** the completion screen is dismissed and the POS returns to catalog/cart view

## Edge Cases

- Discount exceeds subtotal → capped at subtotal, net becomes 0 + tip + tax on 0
- Empty cart with checkout attempt → button is disabled
- Config `TAX_RATE` not loaded → defaults to 12%
- No branches available → auto-select doesn't fire, `branchId` stays empty
- Services/branches API errors → error banner shown in catalog panel
- Products tab with no active products → "No products available" empty state
- Mutation pending → checkout button shows "Processing..." and is disabled
- Cart item quantity decreased below 1 → clamped to 1

## RBAC

- POS page access is gated at the route level by `RequirePermission` (typically `TRANSACTION:canCreate`)
- The POS widget itself does not perform internal permission checks

## Dependencies

- `@/features/inventory/api/use-products` — product catalog with stock levels
- `@/features/config/api/use-config` — tax rate configuration
- `@/features/auth/store` — session access token (for offline sync)
- `@/store/use-branch-store` — shared branch selection
- `@/lib/offline-store` — `saveOfflineTransaction()` for offline persistence
- `@/lib/sync-pending` — `syncPendingTransactions()` for auto-sync on reconnect
