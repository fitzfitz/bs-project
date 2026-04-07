---
name: admin-dashboard
description: Admin dashboard rules — React 19, desktop-first, Shadcn/ui, TanStack Query, Zustand, RBAC
---

> **Applies to globs:** apps/admin/**
> **Always apply:** false

---

# Admin Dashboard Rules — React 19, Desktop-First

## Admin Pre-Flight (Enforced on Every Change)

**Before writing ANY implementation code in this app, you MUST complete these steps in order. See `workflow-gate.mdc` for the full rationale.**

1. **Read/update the spec:** `openspec/specs/admin/<feature>/spec.md`.
2. **Read the backend schema:** The API feature's `.schema.ts`, `.service.ts`, and `.handlers.ts` to understand response shapes (see Backend Schema First section below).
3. **Write/update tests:** `src/features/<name>/__tests__/*.test.tsx` — hook success/error states, widget render/interaction, loading/empty states. Tests WILL fail — that is expected.
4. **THEN implement:** types -> hooks -> widgets/components -> pages (in that order).
5. **Verify:** `pnpm --filter @tmng/barber-admin lint && pnpm --filter @tmng/barber-admin typecheck && pnpm --filter @tmng/barber-admin test` — all three must pass.

**Implementation code without a matching spec update and failing tests is a rule violation. If a plan has code-first tasks, reorder execution to match this checklist.**

---

## Tech Stack (Exact Versions)

- **Framework:** React 19 + React Router v6 (SPA, no SSR) built with Vite v7
- **Styling:** Tailwind CSS v4 (config-less) + Shadcn/ui. No custom CSS unless impossible with Tailwind.
- **Server State:** TanStack Query (`@tanstack/react-query`) for all API data, caching, optimistic updates.
- **Client State:** Zustand for UI/session state (auth store, branch selector, POS cart).
- **Forms:** `react-hook-form` + `@hookform/resolvers/zod` exclusively. No manual controlled state for forms.
- **HTTP Client:** Axios via `lib/api.ts`. Never use raw `fetch` or import `axios` directly in features.
- **Charts:** Recharts for analytics/dashboard visualizations.
- **Drag & Drop:** `@dnd-kit` for queue board and sortable lists.
- **Real-Time:** `pusher-js` via `hooks/use-pusher.ts` for live queue updates.
- **Icons:** `lucide-react` exclusively.
- **Scrollbar:** `overlayscrollbars` + `overlayscrollbars-react` for floating auto-hide overlay scrollbars (replaces native browser scrollbar globally via `document.body`).

## Project Structure

```
src/
├── app/                       # Bootstrap layer
│   ├── index.css              # Tailwind + Shadcn + OverlayScrollbars imports, theme vars, base resets
│   ├── main.tsx               # React root entry point, renders <Providers><App /></Providers>
│   ├── providers.tsx           # All providers (QueryClient, BrowserRouter, ScrollbarInit)
│   └── app.tsx                # Route table (React.lazy + Suspense)
├── components/               # Shared layout shell
│   ├── layout/               #   admin-layout.tsx, sidebar.tsx
│   └── branch-selector.tsx
├── config/                   # env.ts (Vite env vars)
├── features/<domain>/        # Feature-sliced modules (20+ domains)
│   ├── api/                  #   TanStack Query hooks (use-*.ts)
│   ├── widgets/              #   Connected page-section components
│   ├── components/           #   (optional) Pure UI components
│   ├── store/                #   (optional) Zustand stores (e.g. pos/store/)
│   └── types.ts              #   (optional) Zod schemas & TS types
├── hooks/                    # Shared hooks (use-pusher.ts)
├── lib/                      # Infrastructure
│   ├── api.ts                #   Axios client, interceptors, token refresh
│   ├── query-client.ts       #   TanStack Query config
│   ├── offline-store.ts      #   IndexedDB for offline POS
│   ├── sync-pending.ts       #   Offline sync queue
│   └── utils.ts              #   Shared utilities (cn, formatters)
├── pages/<area>/page.tsx     # Thin route shells composing feature widgets
├── routes/_guards/           # ProtectedRoute, RequirePermission
└── store/                    # Global stores (use-branch-store.ts)
```

## Feature Module Rules

- **Subdirectories allowed:** `api/`, `widgets/`, `components/`, `store/`.
- **Types file:** Place as `types.ts` at feature root (NOT a `types/` subdirectory).
- **No barrel exports:** There are no `index.ts` files in admin features. Always import via direct paths: `@/features/auth/store`, `@/features/pos/widgets/pos-checkout`.
- **Path alias:** `@` resolves to `./src`. Always use `@/...` imports, never relative `../../`.

## Pages & Routing

- **Pages are thin shells.** They import feature widgets and compose them. Business logic lives in `features/`, not `pages/`.
- **Lazy loading:** All page components are loaded via `React.lazy()` in `app/app.tsx` with a shared `<Suspense>` fallback.
- **Route guards:**
  - `<ProtectedRoute>` — requires authenticated session (wraps the `<AdminLayout>`).
  - `<RequirePermission feature="FEATURE_CODE" action="canRead">` — checks the user's RBAC permissions from the session store. The `feature` prop is one of the 25 RBAC feature codes (e.g. `QUEUE_MANAGEMENT`, `TRANSACTION`, `INVENTORY`). The optional `action` prop defaults to `canRead`.
- **File naming:** `page.tsx` for standard pages, descriptive names for auth (`login-page.tsx`) and barber portal (`my-schedule.tsx`).

## API Client (`lib/api.ts`)

- Pre-configured Axios instance at `VITE_API_URL` (default `http://localhost:8787/api`).
- **Request interceptor:** Auto-attaches `Authorization: Bearer <token>` and `X-Org-Slug` header from env.
- **Response interceptor:** Unwraps the `{ success, data }` envelope. On `success: false`, throws `ApiError`. On 401, silently refreshes the access token and retries once.
- **Usage in hooks:** `import { api } from "@/lib/api"` then `api.get<T>(url)`, `api.post<T>(url, body)`, etc.
- **Dev proxy:** Vite proxies `/api` to `http://127.0.0.1:8787` so relative URLs work in dev.

## State Management Patterns

- **Auth/session:** `features/auth/store.ts` — Zustand store with `user`, `accessToken`, `refreshToken`, `permissions`. Includes `hasPermission(permissions, feature, action)` helper.
- **Branch context:** `store/use-branch-store.ts` — selected branch for branch-scoped views.
- **Feature-local stores:** Zustand in `features/<name>/store/` (e.g. POS cart in `pos/store/use-pos-store.ts`).
- **Server state:** Always TanStack Query hooks in `features/<name>/api/use-*.ts`. Never store server data in Zustand.

## Offline & PWA

- `vite-plugin-pwa` generates the service worker. Workbox precaches the app shell and runtime-caches API calls to `/api/queue`, `/api/branches`, `/api/staff`, `/api/services`.
- POS offline mode: transactions are queued in IndexedDB (`lib/offline-store.ts`) and synced via `lib/sync-pending.ts` on reconnect.
- Offline UI: `features/pos/components/offline-banner.tsx` and `sync-indicator.tsx` show sync status.

## RBAC Feature Codes (Reference)

These are the `feature` values used in `<RequirePermission>` and the auth store:

`QUEUE_MANAGEMENT`, `TRANSACTION`, `STAFF_MANAGEMENT`, `ATTENDANCE`, `COMMISSION`, `PAYROLL`, `INVENTORY`, `CASH_DRAWER`, `REVIEWS`, `LOYALTY`, `BRANCH_MANAGEMENT`, `ANALYTICS`, `REPORTS`, `USER_MANAGEMENT`, `AUDIT_LOG`, `FINANCE_REPORTS`, `ORG_SETTINGS`, `SERVICE_CATALOG`, `SCHEDULING`, `CRM`, `CAMPAIGNS`, `PROMOTIONS`, `REFERRALS`, `RETENTION`, `PLATFORM_ADMIN`

## Development Process

- Before creating a new TanStack Query hook, read an existing hook in the same feature's `api/` directory and follow its exact pattern.
- Before using a Shadcn/ui component, verify it exists in the project (check `components/ui/`). If missing, install with: `npx shadcn@latest add <component>`.
- Before importing from `@/features/<name>/...`, verify the subdirectory exists. Not all features have `widgets/`, `components/`, or `store/`.
- When adding a new page, follow the existing pattern: lazy-load in `app/app.tsx`, create thin shell in `pages/<area>/page.tsx`, wrap with `<RequirePermission>` if needed.

## SDD + TDD Process

**The mandatory workflow order (spec -> tests -> code -> verify) is defined in `workflow-gate.mdc`. This section covers test tooling details only.**

- Tests live in `features/<name>/__tests__/`.
- **Hook tests:** Mock API with MSW handlers, test success/error/loading states.
- **Widget tests:** Render with `@testing-library/react`, test user interactions and form validation.
- Every widget must have at least: renders correctly, handles loading, handles error, handles empty state.
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
- Run `pnpm --filter @tmng/admin typecheck` after any type change to catch mismatches immediately.
