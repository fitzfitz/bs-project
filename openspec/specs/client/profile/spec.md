# Client — Profile

## Overview

Customer **profile**, **booking history**, **loyalty snapshot**, **receipts**, and **push notification** controls. Most hooks use **TanStack Query** + **Axios**; `useNotifications` reads **React context** from `NotificationProvider` (OneSignal-backed). Mutations update or clear the **Zustand session** where appropriate.

## Business Rules

1. **Profile read:** `useProfile` calls `GET /auth/me` only when `user` exists in the session store; successful `data` is the unwrapped `UserProfileResponse` (envelope `data` only).
2. **Profile update:** `useUpdateProfile` patches `PATCH /auth/me`, then sets React Query `["profile"]` cache and merges fields into the session user via `setUser` when `user` was present.
3. **Delete account:** `useDeleteAccount` sends `DELETE /auth/me` with body `{ confirm: "DELETE" }`; on success runs `queryClient.clear()` and `clearSession()`.
4. **History:** `useHistory` uses `GET /queue/me` with key `['my-bookings', user?.id]` and `enabled: !!user`.
5. **Loyalty snapshot:** `useLoyalty` hits the same `GET /loyalty/me` as loyalty’s account hook but uses query key `["loyalty", "account", user?.id]`; returns full Axios/API response shape (envelope).
6. **Receipt:** `useReceipt(transactionId?)` fetches `GET /transactions/:id/receipt` only when `transactionId` is truthy.
7. **Notifications:** `useNotifications` is context-only; it does not use React Query—behavior matches `NotificationProvider` defaults when missing.

## Components / Widgets

- None under `features/profile` (profile and history pages compose these hooks).

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useProfile` | `GET /auth/me` when `user` is set; returns **unwrapped** `UserProfileResponse` as query data. |
| `useUpdateProfile` | `PATCH /auth/me`; on success updates `['profile']` cache and merges into session via `setUser`. |
| `useDeleteAccount` | `DELETE /auth/me` with body `{ confirm: "DELETE" }`; on success `queryClient.clear()` and `clearSession()`. |
| `useHistory` | `GET /queue/me` → `BookingHistoryItem[]`; key `['my-bookings', user?.id]`. |
| `useLoyalty` | `GET /loyalty/me`; returns full API envelope (same endpoint as loyalty feature; duplicate query key pattern with loyalty account). |
| `useReceipt` | `GET /transactions/:transactionId/receipt` → `ReceiptData`; disabled without id. |
| `useNotifications` | `useContext(NotificationContext)` — push init state, enable/disable, prompt. |

## Hook States

### `useProfile`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** `/auth/me` is fetching  
  - **THEN** query loading flags are true until profile data resolves.

- **Error**  
  - **GIVEN** profile GET fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are set.

- **Disabled**  
  - **GIVEN** no session `user`  
  - **WHEN** the hook runs  
  - **THEN** `enabled` is false.

- **Success**  
  - **GIVEN** success  
  - **WHEN** settled  
  - **THEN** `data` is `UserProfileResponse` (unwrapped).

### `useUpdateProfile`

- **Loading**  
  - **GIVEN** `mutate` was called with name/phone fields  
  - **WHEN** `isPending` is true  
  - **THEN** `PATCH /auth/me` is in flight.

- **Error**  
  - **GIVEN** patch fails  
  - **WHEN** mutation errors  
  - **THEN** mutation `error` is set; session and `["profile"]` cache are not updated by `onSuccess`.

- **Disabled**  
  - **GIVEN** UI prevents concurrent saves  
  - **WHEN** not calling `mutate`  
  - **THEN** no request.

- **Success**  
  - **GIVEN** patch succeeds  
  - **WHEN** `onSuccess` runs  
  - **THEN** `queryClient.setQueryData(["profile"], updatedUser)` and `setUser` merge when `user` exists.

### `useDeleteAccount`

- **Loading**  
  - **GIVEN** delete mutation invoked  
  - **WHEN** `isPending` is true  
  - **THEN** `DELETE /auth/me` with confirm body is in flight.

- **Error**  
  - **GIVEN** delete fails  
  - **WHEN** mutation errors  
  - **THEN** session and caches remain unless success path ran.

- **Disabled**  
  - **GIVEN** caller only invokes after explicit confirmation  
  - **WHEN** not mutating  
  - **THEN** no delete.

- **Success**  
  - **GIVEN** delete succeeds  
  - **WHEN** `onSuccess` runs  
  - **THEN** `queryClient.clear()` and `clearSession()` run.

### `useHistory`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** `GET /queue/me` is in flight  
  - **THEN** loading flags apply.

- **Error**  
  - **GIVEN** history request fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` surface.

- **Disabled**  
  - **GIVEN** no `user`  
  - **WHEN** evaluated  
  - **THEN** `enabled` is false.

- **Success**  
  - **GIVEN** success  
  - **WHEN** settled  
  - **THEN** `data` is `BookingHistoryItem[]` (unwrapped).

### `useLoyalty`

- **Loading**  
  - **GIVEN** `user` is set  
  - **WHEN** `/loyalty/me` fetches  
  - **THEN** query loading applies.

- **Error**  
  - **GIVEN** loyalty GET fails  
  - **WHEN** the query errors  
  - **THEN** error state is available.

- **Disabled**  
  - **GIVEN** no `user`  
  - **WHEN** evaluated  
  - **THEN** `enabled` is false.

- **Success**  
  - **GIVEN** success  
  - **WHEN** settled  
  - **THEN** returned value is the full response object (envelope); not the same unwrapped pattern as `useProfile`.

### `useReceipt(transactionId?)`

- **Loading**  
  - **GIVEN** truthy `transactionId`  
  - **WHEN** receipt is fetching  
  - **THEN** loading flags are true.

- **Error**  
  - **GIVEN** receipt GET fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are set.

- **Disabled**  
  - **GIVEN** falsy `transactionId`  
  - **WHEN** evaluated  
  - **THEN** `enabled` is false.

- **Success**  
  - **GIVEN** valid id and success  
  - **WHEN** settled  
  - **THEN** `data` is unwrapped `ReceiptData`.

### `useNotifications`

- **Loading**  
  - **GIVEN** provider is initializing push / SDK  
  - **WHEN** `isInitialized` is false  
  - **THEN** consumers treat push as not ready (exact flags from context).

- **Error**  
  - **GIVEN** provider does not expose a dedicated query error  
  - **WHEN** enable/prompt fails  
  - **THEN** behavior is whatever the provider sets (no React Query `error` on this hook).

- **Disabled**  
  - **GIVEN** push disabled or permission denied per provider  
  - **WHEN** `isPushEnabled` is false  
  - **THEN** UI should not assume subscriptions are active.

- **Success**  
  - **GIVEN** provider reports initialized and enabled as applicable  
  - **WHEN** consumer reads context  
  - **THEN** `enablePush`, `promptPushOption`, etc. reflect live notification state.

## Types (`types.ts`)

- **`UpdateProfileSchema`** — Zod for profile forms.
- **`UserProfileResponse`**, **`BookingHistoryItem`**, **`ReceiptData`**.

## State

- Session updates via `useSessionStore` (`setUser`, `clearSession`) from profile mutations.
- Notification state lives in `NotificationProvider`, not in this feature module.

## User Interactions

- View/edit profile; delete account; view past queue entries; open receipt by transaction id; toggle or prompt push (via context API).

## Scenarios

### Profile fetch

- **GIVEN** logged-in `user` in the store  
- **WHEN** `useProfile` runs  
- **THEN** `GET /auth/me` returns and data is available as `UserProfileResponse`.

### Profile disabled without session

- **GIVEN** no `user`  
- **WHEN** `useProfile` mounts  
- **THEN** the query is disabled.

### Update profile

- **GIVEN** successful `PATCH /auth/me`  
- **WHEN** `useUpdateProfile` succeeds  
- **THEN** React Query cache and session user fields reflect updates.

### Delete account

- **GIVEN** successful `DELETE /auth/me`  
- **WHEN** mutation completes  
- **THEN** session is cleared and queries are cleared.

### Booking history

- **GIVEN** authenticated customer  
- **WHEN** `useHistory` runs  
- **THEN** `GET /queue/me` populates past visits.

### Receipt

- **GIVEN** a `transactionId`  
- **WHEN** `useReceipt(transactionId)` runs  
- **THEN** receipt details load; without id the query is disabled.

### Notifications context

- **GIVEN** app wrapped in `NotificationProvider`  
- **WHEN** `useNotifications()` is called  
- **THEN** consumers receive `isInitialized`, `isPushEnabled`, `promptPushOption`, `enablePush`.

## Edge Cases

- **`useDeleteAccount`:** Uses Axios `delete` with `data` in config; MSW tests must accept DELETE with body if applicable.
- **`useLoyalty` vs `useLoyaltyAccount`:** Different hooks, same endpoint; both key off user id—cache may duplicate unless unified later.
- **`useNotifications` without provider:** Context default is no-op functions and false flags (no throw).

## Dependencies

- `@tanstack/react-query`, `axios` (`@/lib/api`), `@/features/auth/store`, `@/components/providers/NotificationProvider`, `zod`, `@/features/loyalty/types` (re-export of `CustomerMembership` for `useLoyalty`).
