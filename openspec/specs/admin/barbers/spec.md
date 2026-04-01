# Admin — Barbers (Staff)

## Overview

Admin hooks for **staff profiles** (listed as “barbers” in filenames) backed by **`/staff`** APIs: list/detail, CRUD, branch assignment, and **status** updates. **`useUserSearch`** (`api/use-user-search.ts`) finds users without existing staff profiles via **`/auth/users`**.

There is **no** dedicated `features/barbers/widgets/` directory; staff UI lives on **pages** (barbers roster, queue, attendance).

## Business rules

1. **BR-1 (List staff):** `useBarbers` always registers a query; optional `branchId` / `tier` / `page` refine `GET /staff`.
2. **BR-2 (Detail):** `useBarber(id)` MUST NOT fetch when `id` is null/undefined (`enabled: !!id`).
3. **BR-3 (Mutations):** Successful create/update/delete/assign/unassign/status MUST invalidate `["barbers"]` so roster views refresh.
4. **BR-4 (User search):** Search MUST be debounced 300ms and MUST NOT call the API until the debounced term has length ≥ 2.
5. **BR-5 (Unassign):** `useUnassignBarberBranch` uses HTTP DELETE with a JSON body `{ branchId }` — server and client must support body on DELETE.

## Hook consumers (pages)

| Consumer | Hooks | Notes |
|----------|-------|--------|
| `apps/admin/src/pages/barbers/page.tsx` | `useBarbers`, `useCreateBarber`, `useDeleteBarber`, `useUpdateBarberStatus`, `useAssignBarberBranch`, `useUnassignBarberBranch`, `useUserSearch` | Primary staff roster + “add from user search” flow; uses `useBranches` from POS for branch list (separate spec). |
| `apps/admin/src/pages/queue/page.tsx` | `useBarbers` | Branch-scoped barber list for queue UI. |
| `apps/admin/src/pages/attendance/page.tsx` | `useBarbers` | Barber dropdown for shift creation. |

**Not currently wired in UI (hooks exist for API/tests):** `useBarber`, `useUpdateBarber` — document states for completeness and future detail/edit screens.

## Hooks (`api/use-barbers.ts`, `api/use-user-search.ts`)

| Hook | Method / path | Query key | `enabled` |
|------|---------------|-----------|-----------|
| `useBarbers(params)` | `GET /staff?...` | `["barbers", params]` | always |
| `useBarber(id)` | `GET /staff/:id` | `["barber", id]` | `!!id` |
| `useCreateBarber` | `POST /staff` | — | mutation |
| `useUpdateBarber` | `PATCH /staff/:id` | — | mutation |
| `useDeleteBarber` | `DELETE /staff/:id` | — | mutation |
| `useAssignBarberBranch` | `POST /staff/:id/branches` | — | mutation |
| `useUnassignBarberBranch` | `DELETE /staff/:id/branches` + body | — | mutation |
| `useUpdateBarberStatus` | `PATCH /staff/:id/status` | — | mutation |
| `useUserSearch(term)` | `GET /auth/users?search=&excludeBarbers=true` | `["users", "search", debouncedSearch]` | `debouncedSearch.length >= 2` |

## Request / response shapes

**`useBarbers` query params:** `branchId?`, `tier?`, `page?`.

**`useBarbers` response:** `ApiResponse<StaffProfile[]>`.

**`StaffProfile`:** `id`, `userId`, `bio`, `tier` (`JUNIOR` \| `SENIOR` \| `MASTER`), `status` (`AVAILABLE` \| `BUSY` \| `ON_BREAK` \| `RESERVED` \| `OFF_DUTY`), `specialties[]`, `commissionModel`, `commissionRate`, `baseSalary`, `isActive`, `avatarUrl`, nested `user` (id, names, email), optional `branch`.

**`useBarber` response:** `ApiResponse<StaffProfile>`.

**`useCreateBarber` body (`CreateInput`):** `userId` (required), optional `bio`, `tier`, `specialties`, `commissionModel`, `commissionRate`, `baseSalary` → `ApiResponse<StaffProfile>`.

**`useUpdateBarber` variables:** `CreateInput & { id: string }` → `ApiResponse<StaffProfile>`.

**`useDeleteBarber`:** `id: string` → `ApiResponse<unknown>`.

**`useAssignBarberBranch`:** `{ id, branchId, isPrimary? }` with default `isPrimary: true` in mutation fn → `ApiResponse<unknown>`.

**`useUnassignBarberBranch`:** `{ id, branchId }` → DELETE with `data: { branchId }` → `ApiResponse<unknown>`.

**`useUpdateBarberStatus`:** `{ id, status: string }` → `ApiResponse<StaffProfile>`.

**`useUserSearch` response:** `ApiResponse<SearchUser[]>`.

**`SearchUser`:** `id`, `email`, `firstName`, `lastName`, `tenantRoleId`.

## Hook states

### `useBarbers`

- **Loading:** GIVEN the query is active WHEN fetching THEN `isLoading` / `isFetching` reflect in-flight state and `data` is undefined until success.
- **Error:** GIVEN API failure WHEN settled THEN `isError: true` and `error` is set.
- **Disabled:** GIVEN there is no `enabled: false` on this hook — queries always run; “empty filters” still hits `GET /staff` with minimal query string.
- **Success:** GIVEN success THEN `data.data` is `StaffProfile[]`.

### `useBarber`

- **Loading:** GIVEN `id` is truthy WHEN fetching THEN loading flags true until settled.
- **Error:** GIVEN API failure THEN `isError: true`, `error` set.
- **Disabled:** GIVEN `id` is null WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success THEN `data.data` is `StaffProfile`.

### `useUserSearch`

- **Loading:** GIVEN debounced term length ≥ 2 WHEN request in flight THEN `isLoading` / `isFetching` indicate loading; note debounce delays first fetch after typing stops.
- **Error:** GIVEN API failure THEN `isError: true`, `error` set.
- **Disabled:** GIVEN debounced term has fewer than 2 characters WHEN hook runs THEN `enabled: false`, no `GET /auth/users` call.
- **Success:** GIVEN success THEN `data.data` is `SearchUser[]`.

### Mutations (`useCreateBarber`, `useUpdateBarber`, `useDeleteBarber`, assign/unassign, status)

- **Pending:** GIVEN mutation invoked WHEN in flight THEN `isPending: true`.
- **Error:** GIVEN failure WHEN settled THEN `isError: true`, `error` set.
- **Success:** GIVEN success THEN `["barbers"]` invalidates (all listed mutations).

## UI / widget GWT (barbers page)

- **GIVEN** branch filter and roster **WHEN** `useBarbers` is loading **THEN** barbers page shows loading state (`isLoading` from hook).
- **GIVEN** `useBarbers` errors **THEN** UI should show error feedback (extend page if missing).
- **GIVEN** user types fewer than 2 characters in search **WHEN** `useUserSearch` runs **THEN** no network call; at 2+ characters after debounce, results load; show loading for `userSearchLoading` while fetching.
- **GIVEN** delete or status change **WHEN** mutation `isPending` **THEN** disable triggering controls where implemented to avoid double-submit.

## Scenarios

### List staff

- **GIVEN** optional filters  
- **WHEN** `useBarbers` runs  
- **THEN** `GET /staff` returns staff rows.

### User search debounce

- **GIVEN** search string shorter than 2 characters  
- **WHEN** `useUserSearch` runs  
- **THEN** query is disabled.

### User search fires

- **GIVEN** debounced term length ≥ 2  
- **WHEN** query runs  
- **THEN** `GET /auth/users` is requested with encoded search.

### Mutation invalidates list

- **GIVEN** create/update/delete/assign/unassign/status success  
- **WHEN** mutation settles  
- **THEN** relevant `barbers` queries invalidate.

## Edge cases

- `useBarber` disabled when `id` is null.
- `useUnassignBarberBranch` uses Axios `delete` with `data` option — handlers must support body on DELETE.

## RBAC

- **`STAFF_MANAGEMENT`** (and **`USER_MANAGEMENT`** / auth endpoints for user search, per server).

## Dependencies

- `@tanstack/react-query`, `@/lib/api`, React `useState`/`useEffect` for debounce in `use-user-search.ts`.
