# Admin — Service Catalog

## Overview

The **services** feature provides a **CRUD UI** for the organization service catalog: list with filters, create/edit in a dialog, soft-delete (deactivate) with confirmation, and expandable rows for **tier surcharges**, **branch price overrides**, and **combo children** (simple add actions).

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/service-manager.tsx` | `ServiceManager` — filters, data table, dialogs, expandable detail. |
| `pages/services/page.tsx` | Thin shell: title + `ServiceManager`. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useServices` | `GET /services?category&type&isActive&page&limit` | Query key `["services", params]`; returns envelope + `pagination`. |
| `useCreateService` | `POST /services` | Invalidates `["services"]`. |
| `useUpdateService` | `PATCH /services/:id` | Invalidates `["services"]`. |
| `useDeleteService` | `DELETE /services/:id` | Deactivate; invalidates `["services"]`. |
| `useAddTierSurcharge` | `POST /services/:id/tier-surcharge` | Invalidates `["services"]`. |
| `useAddComboChild` | `POST /services/:id/combo` | Invalidates `["services"]`. |
| `useSetBranchOverride` | `POST /services/:id/branch-override` | Invalidates `["services"]`. |

### Types

- `Service`: scalar fields plus `tierSurcharges`, `comboChildren` (with `childService` summary), `branchOverrides`.
- `ServiceType`: `STANDARD` \| `COMBO` \| `ADD_ON` (aligned with API).

## Business Rules

1. List filters: **category** (from distinct values in loaded data + “All”), **type** (all / standard / combo / add-on), **active** (all / active / inactive → query `isActive` string).
2. **Create/Edit** uses `react-hook-form` + Zod; prices shown as **IDR** in the table; numeric inputs store numbers.
3. **Delete** opens confirmation; on confirm calls `DELETE` (soft-delete).
4. **Branch override** branch picker uses `useBranches` (POS hook); default branch id from `useBranchStore().selectedBranchId` when set.
5. **RBAC:** `SERVICE_CATALOG` (read for list; create/update/delete aligned with API).

## Scenarios

- **GIVEN** services returned **WHEN** manager loads **THEN** table shows name, category, type, price (IDR), duration, active badge.
- **GIVEN** user saves create/edit **WHEN** API succeeds **THEN** dialog closes and list refreshes.
- **GIVEN** user confirms deactivate **WHEN** API succeeds **THEN** list refreshes.
- **GIVEN** expanded row **WHEN** user adds tier / override / combo **THEN** corresponding POST runs and list refreshes.

## Edge Cases

- Empty list: show empty state (not an error).
- API error on list: show error message.
- Loading: skeleton or loading row text.
