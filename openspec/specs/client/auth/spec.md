# Client — Auth

## Overview

Customer authentication for the mobile-first PWA: **login**, **register**, **session persistence** (Zustand + `localStorage`), and shared **JWT attachment** via `@/lib/api` interceptors. There is **no RBAC** in the client app—only a binary **ProtectedRoute** based on `accessToken`. Login and register flows live in pages; this feature provides the session store, Zod form schemas, and the `useAuth` hook (TanStack Query mutations + navigation).

## Business Rules

1. **Login session:** On successful `POST /auth/login`, the client must persist the API user subset (id, tenant role, customer flag, name, email) plus `accessToken` and `refreshToken` via `setSession` before navigation.
2. **Post-login redirect:** Navigation after login uses `location.state.from.pathname` when present; otherwise the target is `/`.
3. **Register redirect:** On successful `POST /auth/register`, the client navigates to `/login` only; it does not establish a session from register alone.
4. **Failure isolation:** Failed login or register leaves the session store unchanged; errors are exposed only on the mutation (`loginError` / `registerError`).
5. **Forms:** Login and register payloads are validated with Zod (`LoginSchema` / `RegisterSchema`) before calling mutations from pages.

## Components / Widgets

- None under `features/auth` (login/register UI is under `pages/auth`).

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useAuth` | `POST /auth/login` and `POST /auth/register`; on login success writes user + tokens via `setSession` and navigates to `location.state.from` or `/`; on register success navigates to `/login`. |

## Hook States

### `useAuth` — login (`login` / `isLoggingIn` / `loginError`)

- **Loading**  
  - **GIVEN** the user submitted credentials  
  - **WHEN** `isLoggingIn` is true  
  - **THEN** the login request is in flight and the UI should avoid duplicate submits.

- **Error**  
  - **GIVEN** `POST /auth/login` fails or returns an error the client surfaces as a mutation error  
  - **WHEN** login completes unsuccessfully  
  - **THEN** `loginError` is set, tokens are not written, and `setSession` is not called.

- **Disabled**  
  - **GIVEN** no special server-side disable flag exists on the hook  
  - **WHEN** the page chooses not to call `login`  
  - **THEN** no request runs; UI may disable the submit control while `isLoggingIn` is true.

- **Success**  
  - **GIVEN** a successful login response with user and tokens  
  - **WHEN** `onSuccess` runs  
  - **THEN** `setSession` stores user + tokens and `navigate(from, { replace: true })` runs with `from` defaulting to `/`.

### `useAuth` — register (`register` / `isRegistering` / `registerError`)

- **Loading**  
  - **GIVEN** the user submitted registration  
  - **WHEN** `isRegistering` is true  
  - **THEN** the register request is in flight.

- **Error**  
  - **GIVEN** `POST /auth/register` fails  
  - **WHEN** the mutation settles with error  
  - **THEN** `registerError` is set and no session is created.

- **Disabled**  
  - **GIVEN** the hook always allows `mutate` when invoked  
  - **WHEN** the UI gates the button  
  - **THEN** registration does not start until the user submits.

- **Success**  
  - **GIVEN** a successful register response  
  - **WHEN** `onSuccess` runs  
  - **THEN** navigation goes to `/login` only (no automatic login).

## State (`store.ts`)

- **`useSessionStore`** (Zustand + `persist`, storage key `tmng-session-storage`): `user`, `accessToken`, `refreshToken`.
- **Actions:** `setSession`, `setTokens`, `setUser`, `clearSession`, `isAuthenticated` (true when `accessToken` is set).

## Types (`types.ts`)

- **`LoginSchema` / `RegisterSchema`:** Zod schemas for form validation.
- **`LoginResponse` / `RegisterResponse`:** API envelope shapes for auth endpoints.

## User Interactions

- Submit login → mutation → session persisted → redirect to intended path or home.
- Submit register → mutation → redirect to login.

## Scenarios

### Login success

- **GIVEN** valid credentials and `POST /auth/login` returns `success: true` with user and tokens  
- **WHEN** `useAuth().login` completes  
- **THEN** `useSessionStore` holds user fields, `accessToken`, and `refreshToken`, and the app navigates away from the login route.

### Login failure

- **GIVEN** the API responds with an error or non-success envelope  
- **WHEN** login is attempted  
- **THEN** the mutation error is set and tokens are not stored.

### Register success

- **GIVEN** valid payload and successful `POST /auth/register`  
- **WHEN** register mutation succeeds  
- **THEN** navigation targets `/login`.

### Session cleared

- **GIVEN** an authenticated session  
- **WHEN** `clearSession` runs  
- **THEN** user and both tokens are null and `isAuthenticated()` is false.

### Persisted session

- **GIVEN** a previous visit stored session in `localStorage`  
- **WHEN** the app loads  
- **THEN** Zustand rehydrates `user` and tokens until `clearSession` or logout elsewhere.

## Edge Cases

- **`from` redirect:** `useAuth` reads `location.state.from.pathname`; missing state defaults to `/`.
- **Interceptor refresh:** Token refresh and 401 retry live in `lib/api.ts`, not in this feature; tests that stub Axios/MSW should use the same base URL as `VITE_API_URL`.
- **Tests:** Clear `tmng-session-storage` and reset store state between cases for determinism.

## Dependencies

- `@tanstack/react-query`, `react-router-dom`, `axios` (`@/lib/api`), `zod`, `zustand` + `persist`.
