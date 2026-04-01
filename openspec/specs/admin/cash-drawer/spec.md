# Admin — Cash drawer

## Overview

Hooks for **current open session** per branch, **open/close session**, and **ledger entries** (sale, refund, adjustment, float). The **session card, entries table, open/close flows, and add-entry form** are implemented inline on **`pages/cash-drawer/page.tsx`** (no separate `widgets/` file).

## Business rules

1. **BR-1 (Current session):** `useCurrentSession(branchId)` MUST NOT call the API when `branchId` is null/empty (`enabled: !!branchId`).
2. **BR-2 (Open session):** On successful open, the `["cash-drawer", "current", branchId]` query for that branch MUST invalidate.
3. **BR-3 (Close session):** On successful close, invalidation MUST use `branchId` from response `data.data.branchId` when present; if absent, current-session cache may be stale until broad refetch.
4. **BR-4 (Add entry):** On success, `useAddEntry` invalidates under `["cash-drawer"]` so current session refetches.
5. **BR-5 (Envelope):** All hooks use `ApiResponse<T>` from `@/lib/api`.

## Hook consumers

| Consumer | Hooks | Role |
|----------|-------|------|
| `apps/admin/src/pages/cash-drawer/page.tsx` | `useCurrentSession`, `useOpenSession`, `useCloseSession`, `useAddEntry` | Branch prompt, loading, empty session → open form; open session → status card, running total, entries table, add entry, close drawer; closed summary modal from close response. |

## Hooks (`api/use-cash-drawer.ts`)

| Hook | Method / path | Query key | `enabled` |
|------|---------------|-----------|-----------|
| `useCurrentSession(branchId)` | `GET /cash-drawer/current?branchId=` | `["cash-drawer", "current", branchId]` | `!!branchId` |
| `useOpenSession` | `POST /cash-drawer/open` | — | mutation |
| `useCloseSession` | `POST /cash-drawer/close` | — | mutation |
| `useAddEntry` | `POST /cash-drawer/entry` | — | mutation |

## Request / response shapes

**`useCurrentSession` response:** `ApiResponse<CashDrawerSession | null>` — `null` means no open session.

**`CashDrawerSession`:** `id`, `branchId`, `openedById`, `openingBalance`, `closingBalance`, `expectedBalance`, `discrepancy` (nullable numerics where closed), `status` (`OPEN` \| `CLOSED`), `openedAt`, `closedAt`, `notes`, optional `branch`, `openedBy`, `entries[]`.

**`CashDrawerEntry`:** `id`, `sessionId`, `type` (`SALE` \| `REFUND` \| `ADJUSTMENT` \| `FLOAT`), `amount`, `reference`, `createdAt`.

**`useOpenSession` body:** `{ branchId: string, openingBalance: number }` → `ApiResponse<CashDrawerSession>`.

**`useCloseSession` body:** `{ sessionId: string, closingBalance: number, notes?: string }` → `ApiResponse<CashDrawerSession>`.

**`useAddEntry` body:** `{ sessionId: string, type, amount: number, reference?: string }` → `ApiResponse<CashDrawerEntry>`.

## Hook states

### `useCurrentSession`

- **Loading:** GIVEN truthy `branchId` WHEN request in flight THEN `isLoading` / `isFetching` true and `data` undefined until settled.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` set.
- **Disabled:** GIVEN `branchId` is null or `""` WHEN hook initializes THEN `enabled: false`, no HTTP call.
- **Success:** GIVEN success THEN `data.data` is `CashDrawerSession | null`.

### `useOpenSession` / `useCloseSession` / `useAddEntry`

- **Pending:** GIVEN mutation invoked WHEN in flight THEN `isPending: true`.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` set.
- **Disabled (UI):** GIVEN invalid form state on cash drawer page (e.g. missing opening balance, negative parse, no session for close/add) WHEN user interacts THEN buttons stay disabled independent of hook.
- **Success:** GIVEN success THEN cache invalidation runs per hook; close returns `CashDrawerSession` for summary UI.

## UI / widget GWT (`pages/cash-drawer/page.tsx`)

### Branch and session shell

- **GIVEN** no `branchId` in store **WHEN** page renders **THEN** copy “Select a branch to continue.” and open/close flows do not run against API for current session.
- **GIVEN** branch selected and `useCurrentSession` loading **WHEN** user views page **THEN** show “Loading...” (not open form yet).
- **GIVEN** `useCurrentSession` error **WHEN** settled **THEN** show error state (recommended; wire `isError` if not present).

### Open session (no session)

- **GIVEN** loaded and `session` is null **WHEN** user enters opening balance **THEN** “Open Drawer” disabled while `openMutation.isPending` or invalid amount; label shows “Opening...” when pending.

### Active session

- **GIVEN** `session` open **WHEN** page renders **THEN** status card shows OPEN, opened-by, running total derived from `openingBalance` + sum of `entries`.
- **GIVEN** add entry form **WHEN** user submits **THEN** button disabled if `!addAmount` or `addEntryMutation.isPending`; shows “Adding...” when pending.
- **GIVEN** close form **WHEN** user submits **THEN** close button disabled for invalid balance or `closeMutation.isPending`; shows “Closing...” when pending; on success modal shows expected/actual/discrepancy from `closedSummary`.

## Scenarios

### Current session

- **GIVEN** a `branchId`  
- **WHEN** `useCurrentSession` runs  
- **THEN** API returns session or null.

### Open session refresh

- **GIVEN** successful open  
- **WHEN** mutation succeeds  
- **THEN** current session query for that `branchId` invalidates.

### Close session

- **GIVEN** valid `sessionId` and `closingBalance`  
- **WHEN** close succeeds  
- **THEN** response includes `branchId` used to invalidate current session.

## Edge cases

- `useCurrentSession` disabled without `branchId`.
- `useCloseSession` `onSuccess` depends on `data?.data?.branchId` — if missing, invalidation may be incomplete until next manual refetch.

## RBAC

- **`CASH_DRAWER`**.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
