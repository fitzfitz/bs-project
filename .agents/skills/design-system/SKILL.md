---
name: design-system
description: Enforces design system component usage across admin and client apps
---

> **Applies to globs:** apps/admin/src/**,apps/client/src/**

---

# Design System Component Rules

**Reference:** `docs/design_system.md`

## Page Structure

- MUST use `PageHeader` from `@/components/ui/page-header` for all page titles — never ad-hoc `<h1>`.
- MUST use `PageContainer` from `@/components/ui/page-container` as the outermost wrapper in every page component.
- MUST use `QueryState` from `@/components/ui/query-state` for any TanStack Query-dependent UI — never manual `if (isLoading)` / `if (error)` checks.

## Data Display

- MUST use `EmptyState` from `@/components/ui/empty-state` for all no-data displays — never inline "No data" text or bare `<p>` elements.
- MUST use `StatCard` from `@/components/ui/stat-card` for metric/KPI displays — never local card components.
- MUST use `DataCardGrid` from `@/components/ui/data-card-grid` for stat card layouts — never repeated `grid grid-cols-*` patterns.
- MUST use `StatusBadge` from `@/components/ui/status-badge` for status indicators — never ad-hoc colored badges.

## Theme Tokens

- MUST use CSS variables for semantic colors — `bg-success`, `text-destructive`, `bg-warning`, `bg-info` — never hardcoded hex values.
- MUST use the typography scale from the design system — see `docs/design_system.md` Section 1.2.
- MUST use Shadcn `Skeleton` component for loading placeholders — never custom pulse animations.

## Navigation

- MUST define all nav items in `lib/nav-config.ts` — never hardcoded navigation arrays in components.
- MUST use `getRouteLabel()` from nav-config for breadcrumb labels — never hardcoded route names.

## Import Paths

All design system components are imported from `@/components/ui/`:
- `@/components/ui/page-header`
- `@/components/ui/page-container`
- `@/components/ui/query-state`
- `@/components/ui/stat-card`
- `@/components/ui/empty-state`
- `@/components/ui/status-badge`
- `@/components/ui/data-card-grid`
