# Admin — CRM (Customer Insights)

## Overview

Branch-scoped **Customer Insights** UI: list customers with spend/visit/recency metrics, filter by segment, sort, paginate, view per-customer detail, list segments, and trigger **recompute** for automatic segments. Requires a selected branch (`BranchSelector` / `useBranchStore`).

## Page

- **`pages/crm/page.tsx`**: Title **Customer Insights**, `BranchSelector`, placeholder when no `branchId`, otherwise `CrmDashboard` with `branchId`.

## Widget (`features/crm/widgets/crm-dashboard.tsx`)

| Area | Behavior |
|------|----------|
| **Table** | Columns: name, email, total visits, total spend (IDR), loyalty tier (badge), segment, days since last visit. Rows open **detail dialog** on click. |
| **Sort** | Toggle **Spend**, **Visits**, **Recency** → `sortBy` query (`spend` \| `visits` \| `recency`, default `recency`). |
| **Segment filter** | `Select` from `GET /crm/segments` (filter value = segment **name**, matches API `segment` query). Option “All segments” clears filter. |
| **Segments panel** | Cards/rows: segment name, member count, **Auto** / **Manual** badge from `isAutomatic`. |
| **Recompute** | `POST /crm/segments/recompute` with `{ branchId }`; loading state on button; on success refresh customer + segment queries (invalidate). |
| **Detail dialog** | All `CustomerInsights` fields; favorite services as tags; uses `GET /crm/customers/:id?branchId=` when dialog open (fresh data). |
| **Empty branch** | Parent page shows “Select a branch…”; widget not mounted without `branchId`. |

## Hooks (`features/crm/api/use-crm.ts`)

| Hook | Endpoint | Notes |
|------|----------|--------|
| `useCrmCustomers` | `GET /crm/customers` | `branchId` required; `segment`, `sortBy`, `page`, `limit`. `queryKey: ["crm-customers", branchId, params]`. Disabled if no `branchId`. |
| `useCrmSegments` | `GET /crm/segments?branchId=` | `queryKey: ["crm-segments", branchId]`. |
| `useCrmCustomer` | `GET /crm/customers/:id?branchId=` | `queryKey: ["crm-customer", id, branchId]`; disabled when id/branch missing. |
| `useRecomputeCrmSegments` | `POST /crm/segments/recompute` | Body `{ branchId }`. On success invalidate `crm-customers` and `crm-segments`. |

Types align with API: `CustomerInsights`, segment list shape (`id`, `name`, `memberCount`, `isAutomatic`).

## API client

- Responses use `{ success, data, pagination? }`; hooks typed with `ApiResponse` + `PaginationResponse` where applicable; consumers read `.data` / `.pagination`.

## States & scenarios

- **Loading:** Table area shows loading indicator while customers query fetching.
- **Error:** Show error message if customers query fails.
- **Empty list:** Message when `data` is empty (success, no rows).
- **Recompute:** Button shows pending state; success updates lists via invalidation.
- **RBAC:** Route wrapped with **`CRM`** read permission; API enforces `CRM` read / recompute rules server-side.

## Edge cases

- `daysSinceLastVisit` / `segment` null → show em dash or “—”.
- Pagination: respect `pagination` from list response; disable prev/next at bounds.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`, `@/components/ui/*` (Table, Button, Select, Badge, Dialog, Card), `lucide-react`.
