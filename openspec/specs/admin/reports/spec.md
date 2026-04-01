# Admin — Reports (Generate & CSV Export)

## Overview

The **reports** feature lets staff pick a **report type**, load **tabular report data** for a branch and date range, preview it in a table, and **export CSV** via `fetch` (not Axios) to a dedicated export endpoint. Download is triggered client-side via blob URL.

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/report-generator.tsx` | `ReportGenerator` — local `type` state, `useReport`, `useExportCSV`, type `<select>`, export button, loading skeleton, table or empty states. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useReport` | `GET /reports/generate?type&branchId&dateFrom&dateTo` | **Enabled** only when `branchId` is truthy. |
| `useExportCSV` | `GET ${VITE_API_URL}/reports/export/csv?...` via `fetch` | Sends `Authorization: Bearer` from `useSessionStore` if present. On success creates blob and programmatic `<a download>`. Throws if `!res.ok`. |

### Types

- `ReportType`: `daily_revenue` | `service_popularity` | `staff_leaderboard` | `customer_visits` | `booking_source`
- `ReportData`: `type`, `columns`, `rows`, `generatedAt`

## State

- **Local:** Selected report `type`.
- **Server:** Cached report payload via TanStack Query.
- **Session:** Access token read at mutation time from Zustand session store.

## User Interactions

1. Change report type in dropdown (refetches when deps change).
2. Click **Export CSV** — disabled while pending or until report data exists.
3. View table: numbers localized; other values stringified; empty rows message.

## Scenarios

- **GIVEN** `branchId` and valid dates **WHEN** report loads **THEN** columns and rows render.
- **GIVEN** report loaded **WHEN** user exports **THEN** fetch succeeds and download path runs (`onSuccess` side effect).
- **GIVEN** export HTTP error **WHEN** user exports **THEN** mutation errors.

## Edge Cases

- `report` null: shows hint “Select a branch and report type…” (also when no data).
- Empty `rows`: dedicated table row “No data for this period”.
- Missing token: export still called; server may reject — handled by `!res.ok`.

## RBAC

- **`REPORTS`** (generate/export). API must enforce tenant + branch access.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`, `@/features/auth/store` (export only), `import.meta.env.VITE_API_URL`, `lucide-react`.
