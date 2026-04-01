# Client — Branches

## Overview

Read-only **branch discovery** for customers: list branches (optional city filter) and fetch a single branch detail. Data is loaded with **TanStack Query** and **Axios** (`@/lib/api`). A **favorite branch** mutation exists for backward compatibility but is a **no-op** (API no longer supports it).

## Business Rules

1. **Branch list:** `useBranches(search?)` calls `GET /branches` with no query when `search` is empty/undefined; a non-empty `search` adds `?city=` with URL-encoded value.
2. **Branch detail:** `useBranch(branchId?)` calls `GET /branches/:id` only when `branchId` is truthy; otherwise the query is disabled.
3. **List data shape:** List and detail hooks return unwrapped `data` from the API envelope as query `data`.
4. **Favorite:** `useSetFavoriteBranch` must resolve without calling the network for any argument (legacy no-op).

## Components / Widgets

- None under `features/branches` (maps/lists live in pages).

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useBranches` | `GET /branches` or `GET /branches?city=` when `search` is provided; returns `data` as `Branch[]`. |
| `useBranch` | `GET /branches/:branchId`; disabled when `branchId` is falsy. |
| `useSetFavoriteBranch` | **No-op** `useMutation`; accepts `_branchId` but performs no network call (legacy API removed). |

## Hook States

### `useBranches(search?)`

- **Loading**  
  - **GIVEN** the list query is mounted  
  - **WHEN** the first fetch runs  
  - **THEN** `isPending` / `isFetching` reflect loading until branches return.

- **Error**  
  - **GIVEN** `GET /branches` (with or without `city`) fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are set.

- **Disabled**  
  - **GIVEN** the hook always enables the query  
  - **WHEN** mounted  
  - **THEN** the list fetch runs (city filter only changes the URL).

- **Success**  
  - **GIVEN** a successful response  
  - **WHEN** data resolves  
  - **THEN** `data` is `Branch[]`.

### `useBranch(branchId?)`

- **Loading**  
  - **GIVEN** a truthy `branchId`  
  - **WHEN** detail is fetching  
  - **THEN** loading flags are true until settled.

- **Error**  
  - **GIVEN** `GET /branches/:id` fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` surface.

- **Disabled**  
  - **GIVEN** `branchId` is falsy  
  - **WHEN** the hook runs  
  - **THEN** `enabled` is false and no request is sent.

- **Success**  
  - **GIVEN** valid id and success  
  - **WHEN** data resolves  
  - **THEN** `data` is branch detail (`BranchDetail`).

### `useSetFavoriteBranch`

- **Loading**  
  - **GIVEN** `mutate` was called  
  - **WHEN** `isPending` is true  
  - **THEN** the no-op `mutationFn` is resolving (no HTTP).

- **Error**  
  - **GIVEN** the empty `mutationFn` cannot fail under normal use  
  - **WHEN** a consumer treats errors  
  - **THEN** errors are unexpected; no API failure path.

- **Disabled**  
  - **GIVEN** the mutation is always invokable  
  - **WHEN** UI omits the action  
  - **THEN** nothing runs.

- **Success**  
  - **GIVEN** any `_branchId` including `null`  
  - **WHEN** `mutate` completes  
  - **THEN** the promise resolves with `undefined` and no network side effects occur.

## State

- None (server state only via React Query).

## User Interactions

- Page-level: search or browse branches, open detail, start booking with `branchId`.

## Scenarios

### List branches

- **GIVEN** no search string  
- **WHEN** `useBranches()` runs  
- **THEN** `GET /branches` is called and the query returns the branch array.

### Filter by city

- **GIVEN** a non-empty `search` argument  
- **WHEN** the query runs  
- **THEN** the request includes `?city=` with encoded value.

### Branch detail

- **GIVEN** a valid `branchId`  
- **WHEN** `useBranch(branchId)` runs  
- **THEN** `GET /branches/:id` returns detail data.

### Branch detail disabled

- **GIVEN** `branchId` is undefined  
- **WHEN** `useBranch` is mounted  
- **THEN** the query does not run.

### Favorite mutation (no-op)

- **GIVEN** `useSetFavoriteBranch`  
- **WHEN** `mutate` is called with any id  
- **THEN** the promise resolves without calling the network.

## Edge Cases

- **Errors:** Failed list/detail requests surface as query `isError` / `error` for UI handling.
- **Empty city filter:** Passing `undefined` or `""` for search should match hook behavior (`search ? query : ''`).

## Dependencies

- `@tanstack/react-query`, `axios` (`@/lib/api`).
