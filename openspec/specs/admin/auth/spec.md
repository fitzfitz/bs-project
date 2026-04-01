# Admin — Auth

## Overview

The auth feature handles **operator login**, **session persistence** (Zustand + `localStorage`), **silent refresh** (via `lib/api` interceptors), and **current-user hydration** from `/auth/me`. It exposes React Query hooks for login and profile refresh, plus pure helpers for admin eligibility and feature-permission checks used by guards and UI.

## Components

- None in `features/auth` (login UI lives under `pages/auth`).

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useLogin` | `POST /auth/login`; on success writes session + tokens to the store and navigates to `/`. |
| `useAuthMe` | `GET /auth/me` when `accessToken` is present; merges staff profile, tenant role, customer flag, and permissions into the session store. |

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/auth/login-page.tsx` | `useLogin` — form submit, pending/error UI. |
| `components/layout/admin-layout.tsx` | `useAuthMe()` on mount to hydrate role and permissions. |

## Business Rules

1. **Login** on success persists user + tokens via `setSession` and navigates to **`/`**; on failure the session must not be written.
2. **`useAuthMe`** runs only when **`accessToken`** is truthy in the session store (`enabled: hasToken`).
3. **`useAuthMe`** uses **`staleTime` 5 minutes**; successful `data` triggers `updateUser` with `staffProfile`, `tenantRole`, `isCustomer`, and `permissions`.
4. **`canAccessAdmin`** requires non-customer and tenant scope **HQ** or **BRANCH**; **`hasPermission` / `hasAnyPermission`** read the JWT-backed permissions map by feature code.
5. Persisted session survives reloads; tests should clear storage for deterministic runs.

## Hook States

### Mutation hooks (`useLogin`)

- **Pending:** GIVEN credentials submitted WHEN `POST /auth/login` is in flight THEN `isPending: true`.
- **Error:** GIVEN invalid credentials or API failure WHEN the mutation rejects THEN `isError: true`, `error` available; session unchanged.
- **Success:** GIVEN `success` response WHEN mutation resolves THEN session is updated, navigation to `/` runs in `onSuccess` (no query invalidation — auth is store-driven).

### Query hooks (`useAuthMe`)

- **Loading:** GIVEN `accessToken` present WHEN `/auth/me` is fetching THEN `isLoading: true`, `data` undefined until settled.
- **Error:** GIVEN API error WHEN query settles THEN `isError: true`, `error` contains message; `useEffect` does not call `updateUser`.
- **Disabled:** GIVEN no `accessToken` in store WHEN hook initializes THEN `enabled: false`, no request.
- **Success:** GIVEN valid `/auth/me` envelope WHEN query succeeds THEN `data` matches `AuthMeResponse`; effect merges fields into the session store.

## State (`store.ts`)

- **`useSessionStore`** (Zustand + `persist`): `user`, `accessToken`, `refreshToken`; actions `setSession`, `setTokens`, `updateUser`, `clearSession`, `isAuthenticated`.
- **Helpers:** `canAccessAdmin` (rejects customer scope; requires `tenantRole.scope` of `HQ` or `BRANCH`), `hasPermission`, `hasAnyPermission` (read the JWT-backed `permissions` map by feature code).

## User Interactions

- Submit email/password → login mutation → session stored → redirect home.
- With a valid token, app mount or feature usage triggers `useAuthMe` to refresh role and permission metadata.

## Scenarios

### Login success

- **GIVEN** valid credentials and a successful `POST /auth/login` envelope  
- **WHEN** the user submits the login form using `useLogin`  
- **THEN** the session store contains user fields, access and refresh tokens, and navigation goes to `/`.

### Login failure

- **GIVEN** the API returns an error or `success: false`  
- **WHEN** login is attempted  
- **THEN** the mutation surfaces an error and the session is not established.

### Auth me refresh

- **GIVEN** a non-null `accessToken` in the store  
- **WHEN** `useAuthMe` runs  
- **THEN** `GET /auth/me` is called and `updateUser` merges returned `staffProfile`, `tenantRole`, `isCustomer`, and `permissions`.

### Auth me disabled without token

- **GIVEN** no `accessToken`  
- **WHEN** `useAuthMe` is mounted  
- **THEN** the query is disabled (no request).

### Permission helpers (RBAC UI)

- **GIVEN** a `permissions` map without a feature key  
- **WHEN** `hasPermission` / `hasAnyPermission` is called  
- **THEN** the result is `false`.

## Edge Cases

- Missing or partial `tenantRole` on user: `canAccessAdmin` returns false unless scope is HQ/BRANCH and user is not a customer.
- `useAuthMe` `staleTime` (5 minutes) may delay refetch; tests should not assume refetch on every render.
- Persisted session can survive reloads; tests should clear `localStorage` keys for deterministic runs.

## RBAC

- **Feature codes:** None directly guard the auth module itself (login is pre-permission).  
- **Related:** Session `permissions` map keys are **platform feature codes** (e.g. `TRANSACTION`, `QUEUE_MANAGEMENT`); downstream routes/widgets should use `hasPermission` / `require-permission` with those codes.

## Dependencies

- `@tanstack/react-query`, `react-router-dom`, `axios` (`@/lib/api`), `zustand` + `persist`.
