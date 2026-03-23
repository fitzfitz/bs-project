# @tmng/barber-client

Customer-facing **Progressive Web App** built with React 19 + Vite 7 + Tailwind CSS 4.

## Quick Start

```bash
# From monorepo root
cp apps/client/.env.example apps/client/.env
pnpm dev:client
```

Runs on `http://localhost:5174`. API requests are proxied to `http://127.0.0.1:8787`.

## Features

- Online booking flow (service > staff > time slot > confirm)
- Branch discovery with map view (Leaflet)
- Loyalty dashboard (tier, points, referrals)
- Booking history with cancel/reschedule
- Reviews with star rating and photo upload
- Push notifications via OneSignal
- PWA: installable, offline-aware via `vite-plugin-pwa`

## Tech Stack

- **React 19** + **TypeScript** + **Vite 7**
- **Tailwind CSS 4** + **Shadcn/ui** (Radix primitives)
- **TanStack Query** for server state
- **Zustand** for session state (persisted)
- **Axios** with silent token refresh interceptor
- **Playwright** for E2E tests (`e2e/`)
