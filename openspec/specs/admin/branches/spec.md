# Admin — Branches

## Overview

Hooks for **branch CRUD details**, **operating hours**, **surge pricing rules**, **emergency close / reopen**, and **branch holidays**.

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useBranch(id)` | `GET /branches/:id` |
| `useUpdateBranch` | `PATCH /branches/:id` |
| `useSetOperatingHours` | `PUT /branches/:id/operating-hours` |
| `useCreateSurgeRule` | `POST /branches/:branchId/surge-rules` |
| `useDeleteSurgeRule` | `DELETE /branches/:branchId/surge-rules/:ruleId` |
| `useEmergencyClose` | `POST /branches/:branchId/emergency-close` |
| `useReopenBranch` | `POST /branches/:branchId/reopen` |
| `useBranchHolidays(branchId)` | `GET /branches/:branchId/holidays` |
| `useCreateHoliday` | `POST /branches/:branchId/holidays` |
| `useDeleteHoliday` | `DELETE /branches/:branchId/holidays/:holidayId` |

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/branches/page.tsx` | `useBranch`, `useUpdateBranch`, `useSetOperatingHours`, `useCreateSurgeRule`, `useDeleteSurgeRule`, `useEmergencyClose`, `useReopenBranch`, `useBranchHolidays`, `useCreateHoliday`, `useDeleteHoliday`. |

## Business Rules

1. **`useBranch(id)`** and **`useBranchHolidays(branchId)`** are **disabled** when `id` / `branchId` is falsy (`enabled: !!id`).
2. **`useUpdateBranch`** invalidates **`["branch", id]`** and **`["branches"]`** on success.
3. **`useSetOperatingHours`** invalidates **`["branch", id]`** after PUT.
4. **Surge** create/delete invalidates **`["branch", branchId]`** for that branch.
5. **Emergency close / reopen** invalidate **`["branch", branchId]`** and **`["branches"]`**.
6. **Holiday** mutations invalidate **`["branch-holidays", branchId]`**.

## Hook States

### Query hooks (`useBranch`, `useBranchHolidays`)

- **Loading:** GIVEN truthy `id` / `branchId` WHEN fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API failure WHEN query settles THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN falsy `id` or `branchId` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `data` matches `Branch` or `BranchHoliday[]` response shape.

### Mutation hooks (`useUpdateBranch`, `useSetOperatingHours`, `useCreateSurgeRule`, `useDeleteSurgeRule`, `useEmergencyClose`, `useReopenBranch`, `useCreateHoliday`, `useDeleteHoliday`)

- **Pending:** GIVEN mutation invoked WHEN HTTP in flight THEN `isPending: true`.
- **Error:** GIVEN API rejects WHEN mutation fails THEN `isError: true`, `error` surfaces to UI.
- **Success:** GIVEN success WHEN settled THEN related queries invalidate per Business Rules (branch / branches / branch-holidays keys).

## State

- React Query: `["branch", id]`, `["branches"]`, `["branch-holidays", branchId]`; mutations invalidate affected keys.

## User Interactions

- Edit branch profile fields; set weekly hours; add/remove surge rules; emergency close or reopen; maintain holiday calendar.

## Scenarios

### Load branch

- **GIVEN** non-empty `id`  
- **WHEN** `useBranch` runs  
- **THEN** `GET /branches/:id` returns.

### Update branch refreshes cache

- **GIVEN** successful `PATCH`  
- **WHEN** mutation completes  
- **THEN** `branch` and `branches` queries invalidate.

### Holiday list scoped

- **GIVEN** `branchId`  
- **WHEN** `useBranchHolidays` runs  
- **THEN** holidays endpoint is called for that branch.

## Edge Cases

- `useBranch` / `useBranchHolidays` disabled when id/branchId falsy.
- Surge rule and holiday IDs must match server routes; typos yield 404 from API.

## RBAC

- **`BRANCH_MANAGEMENT`**.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
