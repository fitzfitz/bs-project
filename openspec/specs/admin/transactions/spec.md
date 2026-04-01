# Admin — Transactions

## Overview

The **transactions** module exposes hooks to **list transactions** by branch (and optional filters), **fetch one transaction**, and **void** a transaction with a reason. UI is on **`apps/admin/src/pages/transactions/page.tsx`**: **filter row**, **data table** (list), and **detail modal** with line items, payments, and void form — no dedicated `features/transactions/widgets/` file.

## Business rules

1. **BR-1 (List scope):** `useTransactions` MUST NOT fetch when `branchId` is falsy (`enabled: !!params.branchId`).
2. **BR-2 (Detail):** `useTransaction(id)` MUST NOT fetch when `id` is null/falsy.
3. **BR-3 (Void):** Successful void MUST invalidate `["transactions"]` (list); detail cache may refresh on next selection.
4. **BR-4 (Void reason):** Client sends `POST /transactions/:id/void` with body `{ reason: string }`; transactions page requires reason length ≥ 5 before submit.
5. **BR-5 (Envelope):** Responses use `ApiResponse<T>`; list may include `pagination` when server sends it (page reads `data?.pagination`).

## Hook consumers

| Consumer | Hooks | Role |
|----------|-------|------|
| `apps/admin/src/pages/transactions/page.tsx` | `useTransactions`, `useTransaction`, `useVoidTransaction` | Auto-select first branch if store empty; filters; table with loading/empty; row “View” sets `selectedId`; modal shows detail when `selectedId && detail`; void section when `detail.status === "COMPLETED"`. |
| Same page (indirect) | `useBranches` from POS | Branch list for initial `setSelectedBranchId` — not part of transactions hooks. |

## Hooks (`api/use-transactions.ts`)

| Hook | Method / path | Query key | `enabled` |
|------|---------------|-----------|-----------|
| `useTransactions(params)` | `GET /transactions?...` | `["transactions", params]` | `!!params.branchId` |
| `useTransaction(id)` | `GET /transactions/:id` | `["transaction", id]` | `!!id` |
| `useVoidTransaction` | `POST /transactions/:id/void` | — | mutation |

## Request / response shapes

**`useTransactions` params (`ListParams`):** `branchId` (required for typing; must be truthy to enable), optional `dateFrom`, `dateTo`, `status`, `page`, `limit`.

**`useTransactions` response:** `ApiResponse<TransactionRow[]>` with optional `pagination` (`page`, `limit`, `total`, `totalPages`).

**`TransactionRow`:** `id`, `branchId`, `status` (`PENDING` \| `COMPLETED` \| `VOIDED` \| `REFUNDED`), `grossAmount`, `discountAmount`, `taxAmount`, `tipAmount`, `netAmount`, `totalDue`, `customerId`, `staffProfileId`, `createdAt`, optional `branch`, `customer`, `staffProfile`, optional `items[]`, `payments[]`.

**`TransactionItem`:** `id`, `name`, `quantity`, `unitPrice`, `discount`.

**`Payment`:** `id`, `method`, `amount`, optional `reference`.

**`useTransaction` response:** `ApiResponse<TransactionRow>` (detail typically includes richer `items` / `payments`).

**`useVoidTransaction` variables:** `{ id: string, reason: string }` → body `{ reason }` → `ApiResponse<TransactionRow>`.

## Hook states

### `useTransactions`

- **Loading:** GIVEN truthy `branchId` WHEN fetch in progress THEN `isLoading` true; page shows “Loading...” instead of table.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` set (add banner for parity with reviews if missing).
- **Disabled:** GIVEN `branchId` is `""` (e.g. before auto-select) WHEN hook runs THEN `enabled: false`, no list request.
- **Success:** GIVEN success THEN `data.data` is `TransactionRow[]` and optional `data.pagination` for pager.

### `useTransaction`

- **Loading:** GIVEN non-null `selectedId` WHEN detail fetch runs THEN loading state available (`isLoading`); modal only renders when `detail` truthy today — spec: show spinner in modal while loading if `selectedId` set and `!detail`.
- **Error:** GIVEN API error THEN `isError: true`, `error` set.
- **Disabled:** GIVEN `id` null WHEN hook runs THEN `enabled: false`, no request.
- **Success:** GIVEN success THEN `data.data` is `TransactionRow`.

### `useVoidTransaction`

- **Pending:** GIVEN void submitted WHEN in flight THEN `isPending: true`; void button shows “Voiding...” and is disabled.
- **Error:** GIVEN API error THEN `isError: true`, `error` set.
- **Disabled (UI):** GIVEN `voidReason.length < 5` **THEN** void button disabled on transactions page.
- **Success:** GIVEN success THEN `["transactions"]` invalidates; page clears reason and closes selection on success handler.

## UI / widget GWT (transactions page)

- **GIVEN** date/status filters change **WHEN** user edits **THEN** reset page to 1 and refetch list.
- **GIVEN** list loading **WHEN** user views table area **THEN** “Loading...” text instead of rows.
- **GIVEN** empty list **WHEN** success **THEN** “No transactions found.” row.
- **GIVEN** user clicks View **WHEN** row selected **THEN** `useTransaction(selectedId)` runs; modal shows when `detail` available.
- **GIVEN** completed transaction in modal **WHEN** user enters reason **THEN** void disabled until ≥ 5 chars and not `voidMutation.isPending`.
- **GIVEN** pagination metadata **WHEN** `totalPages > 1` **THEN** Prev/Next disabled at bounds (`disabled:opacity-40`).

## Scenarios

- **GIVEN** missing `branchId` **WHEN** `useTransactions` used **THEN** no fetch.
- **GIVEN** void succeeds **WHEN** mutation completes **THEN** transactions queries invalidate.

## Edge cases

- High page sizes: server should cap `limit`; client passes through if set.
- Void idempotent behavior is server-defined.

## RBAC

- **`TRANSACTION`** read for list/detail; void typically requires **update** or elevated POS permission. API is authoritative.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
