# Admin — User Management

## Overview

The **users** feature provides **paginated user listing** with search, role filter, active filter, and **actions**: change **tenant role**, **assign branch** (with branch picker from POS `useBranches`), **remove branch** assignment, **deactivate**, **reactivate**.

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/user-management.tsx` | `UserManagement` — filters, table, pagination, role modal, `BranchAssignDialog` (nested). |
| `widgets/user-management.tsx` | `BranchAssignDialog` — branch `<select>` from `useBranches`, assign CTA. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useUsers` | `GET /users?...` | Supports `tenantRoleId`, `branchId`, `search`, `isActive`, `page`, `limit`. |
| `useUser` | `GET /users/:id` | Detail (not used in main widget but available). |
| `useUpdateUserRole` | `PATCH /users/:id/role` | Invalidates `users` + `user`. |
| `useAssignUserBranch` | `POST /users/:id/assign-branch` | Invalidates `users` + `user`. |
| `useRemoveUserBranch` | `DELETE /users/:id/assign-branch/:branchId` | Invalidates `users` + `user`. |
| `useDeactivateUser` | `PATCH /users/:id/deactivate` | Invalidates `users` + `user`. |
| `useReactivateUser` | `PATCH /users/:id/reactivate` | Invalidates `users` + `user`. |

### Types

- `UserRow`, `UserDetail`: identity, `tenantRole`, `branch`, `staffProfile`, flags.

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/users/page.tsx` | Renders `UserManagement`. |
| `widgets/user-management.tsx` | `useUsers`, `useUpdateUserRole`, `useAssignUserBranch`, `useRemoveUserBranch`, `useDeactivateUser`, `useReactivateUser`, plus `useBranches` from POS feature for assign dialog. |
| Other callers | `useUser(id)` for detail when `id` non-null (`enabled: !!id`). |

## Business Rules

1. **`useUsers`** builds query string from optional filters and pagination; key is **`["users", params]`**.
2. **`useUser(id)`** is **disabled** when `id` is null/empty.
3. **Role / branch / deactivate / reactivate** mutations each invalidate **`["users"]`** and **`["user"]`** on success.
4. **UI** resets page to 1 when search or filters change; role save disabled when unchanged or mutation pending.
5. **RBAC:** **`USER_MANAGEMENT`**; API enforces role/branch rules.

## Hook States

### Query hooks (`useUsers`, `useUser`)

- **Loading:** GIVEN enabled query WHEN fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` contains message.
- **Disabled:** GIVEN `useUser` with null `id` WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN success WHEN settled THEN `useUsers` returns list + `pagination`; `useUser` returns `UserDetail`.

### Mutation hooks (`useUpdateUserRole`, `useAssignUserBranch`, `useRemoveUserBranch`, `useDeactivateUser`, `useReactivateUser`)

- **Pending:** GIVEN action triggered WHEN HTTP in flight THEN `isPending: true` (dialogs disable save as implemented).
- **Error:** GIVEN API rejects WHEN mutation fails THEN `isError: true`, error surfaced in UI.
- **Success:** GIVEN success WHEN mutation resolves THEN **`["users"]`** and **`["user"]`** invalidate.

## State

- **Local:** Search string, role filter, active filter, page, selected user, dialog visibility, draft role/branch.
- **Server:** TanStack Query for users list + branches list.

## User Interactions

1. Type search / change filters → resets page to 1.
2. Pagination prev/next when `totalPages > 1`.
3. **Shield** opens role dialog; **Building** opens assign dialog; **UserX/UserCheck** deactivate/reactivate.
4. **X** on branch chip removes branch (immediate mutation).
5. Role update disabled when unchanged or pending.

## Scenarios

- **GIVEN** users returned **WHEN** page renders **THEN** table shows name, email, role badge, branch chip, status, actions.
- **GIVEN** user opens role dialog and picks new role **WHEN** save **THEN** `PATCH /users/:id/role` fires and dialog closes on success.
- **GIVEN** assign dialog **WHEN** user selects branch and assigns **THEN** `POST assign-branch` fires.

## Edge Cases

- `buildRoleOptions` ensures selected user’s role appears even if not in current page.
- Users without branch: “No branch” and assign flow.
- `SCOPE_COLORS` fallback for unknown scope.

## RBAC

- **`USER_MANAGEMENT`** (read/update). Role changes may require **`ROLE_MANAGEMENT`** depending on API rules. All enforcement on API + route guards.

## Dependencies

- `@/features/pos/api/use-branches`, `@tanstack/react-query`, `@/lib/api`, `lucide-react`.
