# @tmng/barber-admin

Admin dashboard for branch operations, POS, staff management, and super admin analytics. Built with React 19 + Vite 7 + Tailwind CSS 4.

## Quick Start

```bash
# From monorepo root
cp apps/admin/.env.example apps/admin/.env
pnpm dev:admin
```

Runs on `http://localhost:5175`. API requests are proxied to `http://127.0.0.1:8787`.

## Features

- **Queue Management** — DnD Kanban board with real-time Pusher updates
- **POS Checkout** — Services + Products tabs, discounts, tips, CASH/QRIS/CARD/E-Wallet payment, dynamic tax from config, offline fallback (IndexedDB) with sync UI (pending/failed/retry/cleanup)
- **Staff Management** — Profiles, branch assignment, status, tier management
- **Attendance & Scheduling** — Clock-in/out, shift blocks, weekly calendar view, leave management
- **Commission & Payroll** — Earnings tracking, period generation, approval workflow
- **Inventory** — Product CRUD, stock-in/stock-out/adjust action dialogs per product row, low-stock alerts
- **Cash Drawer** — Open/close sessions, entries, end-of-day reconciliation
- **Reviews & Loyalty** — Moderation, customer lookup, manual point adjust
- **Staff Portal** — Role-gated views (My Schedule, My Commissions, My Attendance)
- **Analytics** — Multi-branch dashboard, comparison, peak heatmap, retention cohorts, per-barber utilization rates
- **Reports** — 5 report types with CSV export
- **Financial Oversight** — P&L summary, payroll oversight, void/discount audit
- **User Management** — Role assignment, branch assignment, activate/deactivate
- **Audit Log** — Filterable logs, anomaly detection, resolve dialog
- **Platform Config** — Org-level settings (loyalty, referrals, POS & tax)

## Access Control

The admin app uses **permission-based** access control driven by the API's RBAC system:

- **Login/Me responses** include a full `permissions` matrix (25 features × CRUD)
- **Sidebar** dynamically shows/hides menu items based on the user's permissions
- **Route guards** (`<RequirePermission>`) redirect unauthorized users to the dashboard
- **Barber portal** shows a simplified dashboard (queue + commissions), separate from the main admin views

| Role | Visible Menu Items |
|------|-------------------|
| Owner (HQ) | All features + Administration panel |
| Manager (Branch) | Most features + Analytics/Reports/Users/Audit (read) |
| Cashier (Branch) | Queue, POS, Transactions, Cash Drawer, Inventory |
| Barber (Branch) | My Schedule, My Commissions, My Attendance |

## Tech Stack

- **React 19** + **TypeScript** + **Vite 7**
- **Tailwind CSS 4** + **Shadcn/ui** (Radix primitives)
- **TanStack Query** for server state
- **Zustand** for session state (persisted)
- **dnd-kit** for drag-and-drop queue management
- **Recharts** for analytics charts
- **Axios** with silent token refresh interceptor
- **Playwright** for E2E tests (`e2e/`)
- **vite-plugin-pwa** for offline-capable admin app (service worker + workbox)
