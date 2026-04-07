---
trigger: model_decision
description: Client PWA rules — React 19, mobile-first, booking, loyalty, reviews, 6 feature domains only
globs: apps/client/**
---

# Client PWA Rules — React 19, Mobile-First

## Client Pre-Flight (Enforced on Every Change)

**Before writing ANY implementation code in this app, you MUST complete these steps in order. See `workflow-gate.mdc` for the full rationale.**

1. **Read/update the spec:** `openspec/specs/client/<feature>/spec.md`.
2. **Read the backend schema:** The API feature's `.schema.ts`, `.service.ts`, and `.handlers.ts` to understand response shapes (see Backend Schema First section below).
3. **Write/update tests:** `src/features/<name>/__tests__/*.test.tsx` — hook success/error states, component render/interaction, booking flow steps. Tests WILL fail — that is expected.
4. **THEN implement:** types -> hooks -> components/widgets -> pages (in that order).
5. **Verify:** `pnpm --filter @tmng/barber-client lint && pnpm --filter @tmng/barber-client typecheck && pnpm --filter @tmng/barber-client test` — all three must pass.

**Implementation code without a matching spec update and failing tests is a rule violation. If a plan has code-first tasks, reorder execution to match this checklist.**

---

## Tech Stack (Exact Versions)

- **Framework:** React 19 + React Router v6 (SPA, no SSR) built with Vite v7
- **Styling:** Tailwind CSS v4 (config-less) + Shadcn/ui. No custom CSS unless impossible with Tailwind.
- **Server State:** TanStack Query (`@tanstack/react-query`) for all API data, caching, optimistic updates.
- **Client State:** Zustand for UI/session state (auth store, booking wizard state).
- **Forms:** `react-hook-form` + `@hookform/resolvers/zod` exclusively. No manual controlled state for forms.
- **HTTP Client:** Axios via `lib/api.ts`. Never use raw `fetch` or import `axios` directly in features.
- **Maps:** Leaflet + `react-leaflet` for branch location maps.
- **Push Notifications:** OneSignal via `react-onesignal` (`components/providers/NotificationProvider.tsx`).
- **Icons:** `lucide-react` exclusively.
- **Date Formatting:** `date-fns` for display-layer date operations.
- **Scrollbar:** `overlayscrollbars` + `overlayscrollbars-react` for floating auto-hide overlay scrollbars (replaces native browser scrollbar globally via `document.body`).

## App Identity

This is the **customer-facing Progressive Web App** — mobile-first, installable, offline-aware. It handles booking, branch discovery, loyalty, reviews, and profile management. It does NOT have admin features, RBAC permission checks, or staff management.

## Project Structure

```
src/
├── app/                       # Bootstrap layer
│   ├── index.css              # Tailwind + OverlayScrollbars imports, theme vars, base resets
│   ├── main.tsx               # React root entry point, renders <Providers><App /></Providers>
│   ├── providers.tsx           # All providers (QueryClient, BrowserRouter, Notifications, Confirmation, ScrollbarInit)
│   └── app.tsx                # Route table (Routes/Route tree)
├── components/
│   ├── layout/               # AppLayout.tsx, BottomNav.tsx
│   ├── providers/            # NotificationProvider.tsx (OneSignal)
│   └── ui/                   # Shared primitives (button, form, input, label)
├── config/env.ts             # Vite env vars
├── features/                 # 6 feature domains (see below)
│   ├── auth/                 #   api/, store.ts, types.ts
│   ├── booking/              #   api/ (7 hooks), components/ (4 steps), store.ts, types.ts
│   ├── branches/             #   api/ only (3 hooks)
│   ├── loyalty/              #   api/, components/, widgets/, types/index.ts, index.ts
│   ├── profile/              #   api/ (5 hooks), types.ts
│   └── reviews/              #   api/, components/, widgets/, types/index.ts, index.ts
├── lib/
│   ├── api.ts                # Axios client, interceptors, token refresh
│   └── utils.ts
├── pages/<area>/             # Route-level screens (*-page.tsx)
├── routes/_guards/           # ProtectedRoute only (no RBAC)
├── styles/receipt-print.css  # Print stylesheet
└── utils/cn.ts               # className merge utility
```

## Feature Module Rules

- **Only 6 domains exist.** Do not create new feature directories without discussion.
- **Subdirectories allowed:** `api/`, `components/`, `widgets/`, `types/`.
- **Barrel exports:** Only `features/loyalty/index.ts` and `features/reviews/index.ts` have barrel re-exports. All other features use direct path imports.
- **Path alias:** `@` resolves to `./src`. Always use `@/...` imports, never relative `../../`.

## Routing & Navigation

- **Layout:** `AppLayout` wraps all main routes and renders `<BottomNav>` for mobile tab navigation.
- **Auth routes** (`/login`, `/register`, `/forgot-password`) and **legal routes** (`/legal/terms`, `/legal/privacy`) sit outside `AppLayout`.
- **Route guard:** Only `<ProtectedRoute>` exists — checks `isAuthenticated()` from auth store, redirects to `/login`. There is NO permission/RBAC guard on the client app.
- **Booking wizard:** Nested routes under `/book/:branchId`:
  - `/book/:branchId` -> `ServiceSelection`
  - `/book/:branchId/barber` -> `BarberSelection`
  - `/book/:branchId/time` -> `TimeSelection`
  - `/book/:branchId/confirm` -> `BookingConfirm`
  - These step components live in `features/booking/components/`, wrapped by `pages/booking/booking-layout.tsx` (uses `<Outlet />`).

## API Client (`lib/api.ts`)

- Pre-configured Axios instance at `VITE_API_URL` (default `http://localhost:8787/api`).
- **Request interceptor:** Auto-attaches `Authorization: Bearer <token>` and `X-Org-Slug` header from env.
- **Response interceptor:** Unwraps the `{ success, data }` envelope. On `success: false`, throws `ApiError`. On 401, silently refreshes the access token and retries once.
- **Usage in hooks:** `import { api } from "@/lib/api"` then `api.get<T>(url)`, `api.post<T>(url, body)`, etc.
- **Dev proxy:** Vite proxies `/api` to `http://127.0.0.1:8787`.

## State Management

- **Auth/session:** `features/auth/store.ts` — Zustand store with `user`, `accessToken`, `refreshToken`. Includes `isAuthenticated()` selector.
- **Booking wizard:** `features/booking/store.ts` — Zustand store for multi-step booking state (selected services, barber, time slot).
- **Server state:** Always TanStack Query hooks in `features/<name>/api/use-*.ts`. Never store server data in Zustand.

## PWA & Offline

- `vite-plugin-pwa` generates the service worker with manifest (standalone mode, themed icons).
- Workbox runtime caching: `/api/branches` and `/api/services` use stale-while-revalidate, other `/api/` calls use network-first with 10s timeout.
- The app is installable with a proper Web App Manifest.

## Development Process

- Before creating a new TanStack Query hook, read an existing hook in the same feature's `api/` directory and follow its exact pattern.
- Before using a Shadcn/ui component, verify it exists in `components/ui/`. If missing, install with: `npx shadcn@latest add <component>`.
- Before importing from `@/features/<name>/...`, verify the subdirectory exists. Not all 6 features have the same structure.
- This app has only 6 feature domains. Do NOT create new feature directories without explicit discussion.
- This app has NO RBAC/permission guards. Do NOT add `RequirePermission` or similar — only `ProtectedRoute` exists.

## SDD + TDD Process

**The mandatory workflow order (spec -> tests -> code -> verify) is defined in `workflow-gate.mdc`. This section covers test tooling details only.**

- Tests live in `features/<name>/__tests__/`.
- **Hook tests:** Mock API with MSW handlers, test success/error/loading states.
- **Component tests:** Render with `@testing-library/react`, test user flow and form validation.
- Booking wizard tests must cover the full multi-step flow (service -> barber -> time -> confirm).
- MSW setup: `src/test/server.ts` (shared), feature-specific handlers via `server.use()` in test files.

## Backend Schema First (Type Safety)

- Before writing or modifying ANY frontend type, hook, or API integration, you MUST read the corresponding backend files:
  1. The API feature's `.schema.ts` to see Zod request/response shapes.
  2. The API feature's `.service.ts` to see what Prisma actually returns (include/select).
  3. The API feature's `.handlers.ts` to see how the response is constructed.
- Frontend types MUST match the actual API response shape. Never invent fields the API does not send.
- Replace all `unknown` and `any` in API response types with concrete types matching the backend schema.
- When the backend uses `z.any()` for responses, treat the Prisma return shape in the service as the source of truth.
- If the backend schema changes, the frontend types MUST be updated in the same PR.
- Run `pnpm --filter @tmng/client typecheck` after any type change to catch mismatches immediately.