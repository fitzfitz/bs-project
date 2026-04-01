# Feature: Design System Composite Components

## Overview

Reusable composite components that enforce design consistency across all admin pages. Built on top of Shadcn primitives and the theme token layer from Sprint 1.1.

## Core Components (Sprint 1.2)

### PageHeader

Standardized page title bar replacing 27 ad-hoc `<h1>` patterns.

**Props:**
- `title: string` — Page title (required)
- `description?: string` — Optional subtitle/description
- `actions?: ReactNode` — Right-aligned slot for buttons, filters, BranchSelector
- `badge?: ReactNode` — Optional badge next to title (e.g., count)

**Renders:**
- Outer `div` with `flex items-center gap-4 flex-wrap`
- `h1` with `text-2xl font-semibold tracking-tight text-foreground`
- If badge provided, renders inline next to title
- If description provided, renders below title as `text-sm text-muted-foreground`
- Actions pushed to the right with `ml-auto`

### PageContainer

Standard page wrapper enforcing consistent spacing.

**Props:**
- `children: ReactNode` — Page content (required)
- `className?: string` — Additional classes (merged via `cn()`)

**Renders:**
- `<div className={cn("space-y-6", className)}>{children}</div>`

### QueryState

TanStack Query loading/error/empty wrapper. Eliminates manual `if (isLoading)` / `if (error)` boilerplate.

**Props (generic T):**
- `query: UseQueryResult<T>` — TanStack Query result object (required)
- `empty?: ReactNode | ((data: T) => boolean)` — Empty state UI or predicate to check if data is empty
- `loadingFallback?: ReactNode` — Custom loading UI (defaults to Skeleton grid)
- `errorFallback?: ReactNode | ((error: Error) => ReactNode)` — Custom error UI
- `children: (data: T) => ReactNode` — Render function receiving data on success

**Behavior:**
1. `query.isLoading` → render `loadingFallback` or default skeleton
2. `query.isError` → render `errorFallback` or default error display with message
3. `query.data` exists but `empty` predicate is truthy → render `empty` ReactNode or default empty state
4. `query.data` exists → call `children(data)`

**Default loading:** 3 Skeleton bars (`h-10 w-full rounded-lg`)
**Default error:** Red-tinted card with error message and "Try again" button calling `query.refetch()`
**Default empty check:** If `empty` is not provided, always renders children. If `empty` is a function, calls it with data. If `empty` is ReactNode, checks `Array.isArray(data) && data.length === 0`.

## Extended Components (Sprint 1.3)

### StatCard

Reusable metric display card.

**Props:**
- `label: string` — Metric name
- `value: string | number` — Primary metric value
- `icon?: LucideIcon` — Optional icon
- `trend?: { value: number; direction: 'up' | 'down' }` — Trend indicator
- `loading?: boolean` — Show skeleton variant
- `className?: string` — Extra classes

### EmptyState

Standardized no-data display.

**Props:**
- `icon?: LucideIcon` — Decorative icon
- `title: string` — Heading
- `description?: string` — Explanatory text
- `action?: ReactNode` — CTA button

### StatusBadge

Semantic colored badge.

**Props:**
- `variant: 'success' | 'warning' | 'error' | 'info' | 'default'` — Color variant
- `children: ReactNode` — Badge text

### DataCardGrid

Responsive grid for stat cards.

**Props:**
- `children: ReactNode` — Grid items
- `columns?: 2 | 3 | 4` — Column count (default: 4)

## Success Criteria

- All components are importable from `@/components/ui/`
- TypeScript props are fully typed (no `any`)
- Components render correctly in isolation (unit tests)
- QueryState handles all TanStack Query states correctly
- All tests pass: `pnpm --filter @tmng/barber-admin test`
