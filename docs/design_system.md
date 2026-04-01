# Design System

> **Status:** Living document — updated incrementally during the admin UI redesign sprints.
> **Scope:** `@tmng/barber-admin` (primary). Will be extended to `@tmng/barber-client` after the admin redesign is complete.
> **Last updated:** Mar 28, 2026 — All 12 sprints complete.

---

## 1. Theme Tokens

### 1.1 Color Palette

**Brand:**
- `--primary: #b57231` — Brand amber/brown, used for primary actions, active states, accents
- `--primary-foreground: #ffffff` — Text on primary backgrounds

**Semantic:**
- `--success: #22c55e` / `--success-foreground: #ffffff` — Positive states (completed, approved, online)
- `--warning: #f59e0b` / `--warning-foreground: #ffffff` — Caution states (low stock, expiring)
- `--info: #3b82f6` / `--info-foreground: #ffffff` — Informational states (in-progress, pending)
- `--destructive: #ef4444` — Error and danger states

Tailwind v4 utility classes: `bg-success`, `text-success-foreground`, `bg-warning`, `text-warning-foreground`, `bg-info`, `text-info-foreground`.

**Neutral (existing Shadcn tokens):**
- `--background`, `--foreground`, `--card`, `--muted`, `--accent`, `--border`, `--input`

### 1.2 Typography Scale

| Role | Tailwind Classes | Usage |
|------|-----------------|-------|
| Page Title | `text-2xl font-semibold tracking-tight text-foreground` | Main heading on every page (via PageHeader) |
| Section Title | `text-lg font-semibold text-foreground` | Card headers, form section titles |
| Card Title | `text-sm font-medium text-foreground` | Stat card labels, table column headers |
| Body | `text-sm text-foreground` | Default body text |
| Caption | `text-xs text-muted-foreground` | Timestamps, helper text, secondary info |
| Badge Text | `text-[11px] font-medium` | Status badges, role badges, count badges |
| Nav Item | `text-[13px] font-medium` | Sidebar navigation labels |
| Group Label | `text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground` | Sidebar group headers |

### 1.3 Spacing

| Level | Value | Usage |
|-------|-------|-------|
| Page-level | `space-y-6` | Between major sections on a page |
| Section-level | `space-y-4` | Between items within a section |
| Component-level | `space-y-2` or `gap-2` | Between elements within a component |
| Row gaps | `gap-4` | Between items in a flex/grid row |
| Page padding | `p-6` | Main content area padding |

### 1.4 Elevation (Shadows)

| Level | Class | Usage |
|-------|-------|-------|
| Flat | No shadow | Default for most elements |
| Card | `shadow-sm` | Cards, stat cards, sidebar |
| Dropdown | `shadow-md` | Dropdown menus, popovers |
| Modal | `shadow-lg` | Dialogs, command palette, sheets |
| Topbar | `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` | Header/topbar subtle shadow |

### 1.5 Border Radius

| Class | Usage |
|-------|-------|
| `rounded-lg` | Cards, buttons, inputs (default) |
| `rounded-xl` | Sidebar items, larger cards |
| `rounded-full` | Avatars, circular badges |

---

## 2. Component Catalog

### 2.1 PageHeader

Standardized page title bar used on every page.

**Import:** `import { PageHeader } from "@/components/ui/page-header"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Page title text |
| `description` | `string` | No | Subtitle below title |
| `actions` | `ReactNode` | No | Right-aligned slot (buttons, selectors) |
| `badge` | `ReactNode` | No | Inline badge next to title |
| `className` | `string` | No | Additional CSS classes |

**Usage:**

```tsx
<PageHeader
  title={t("queue:title")}
  badge={<Badge>12 entries</Badge>}
  actions={
    <>
      <BranchSelector />
      <Button>Walk-In</Button>
    </>
  }
/>
```

**Do:** Always use PageHeader for page titles.
**Don't:** Never use ad-hoc `<h1>` elements or custom title patterns.

### 2.2 PageContainer

Standard page wrapper enforcing consistent page-level spacing.

**Import:** `import { PageContainer } from "@/components/ui/page-container"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Page content |
| `className` | `string` | No | Additional CSS classes |

**Usage:**

```tsx
<PageContainer>
  <PageHeader title="Dashboard" />
  {/* page content */}
</PageContainer>
```

**Do:** Wrap every page in PageContainer.
**Don't:** Never use ad-hoc `<div className="space-y-6">` as the outermost wrapper.

### 2.3 QueryState

TanStack Query loading/error/empty handler. Eliminates manual `if (isLoading)` / `if (error)` boilerplate.

**Import:** `import { QueryState } from "@/components/ui/query-state"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `UseQueryResult<T>` | Yes | TanStack Query result |
| `empty` | `ReactNode \| ((data: T) => boolean)` | No | Empty state or predicate |
| `loadingFallback` | `ReactNode` | No | Custom loading UI |
| `errorFallback` | `ReactNode \| ((error: Error) => ReactNode)` | No | Custom error UI |
| `children` | `(data: T) => ReactNode` | Yes | Render function |

**Behavior:** Loading → skeleton, Error → retry panel, Empty → empty state, Success → children.

**Usage:**

```tsx
<QueryState
  query={transactionsQuery}
  empty={<EmptyState icon={Inbox} title={t("transactions:noData")} />}
>
  {(data) => <TransactionsTable data={data} />}
</QueryState>
```

### 2.4 StatCard

Metric display card with optional icon and trend indicator.

**Import:** `import { StatCard } from "@/components/ui/stat-card"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | Yes | Metric name |
| `value` | `string \| number` | Yes | Primary value |
| `icon` | `LucideIcon` | No | Display icon |
| `trend` | `{ value: number; direction: 'up' \| 'down' }` | No | Trend indicator |
| `loading` | `boolean` | No | Show skeleton variant |
| `className` | `string` | No | Additional classes |

### 2.5 EmptyState

Standardized no-data display.

**Import:** `import { EmptyState } from "@/components/ui/empty-state"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `LucideIcon` | No | Decorative icon |
| `title` | `string` | Yes | Empty state heading |
| `description` | `string` | No | Explanatory text |
| `action` | `ReactNode` | No | CTA button |

### 2.6 StatusBadge

Semantic colored badge for status displays.

**Import:** `import { StatusBadge } from "@/components/ui/status-badge"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'success' \| 'warning' \| 'error' \| 'info' \| 'default'` | Yes | Color variant |
| `children` | `ReactNode` | Yes | Badge text |

### 2.7 DataCardGrid

Responsive grid for stat cards.

**Import:** `import { DataCardGrid } from "@/components/ui/data-card-grid"`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Grid items |
| `columns` | `2 \| 3 \| 4` | No | Column count (default: 4) |

---

## 3. Page Layout Patterns

### Standard Page Structure

```tsx
export default function FeaturePage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        title={t("feature:title")}
        actions={<BranchSelector />}
      />
      {/* Page content using design system components */}
    </PageContainer>
  );
}
```

### Query-Dependent Content

```tsx
<QueryState
  query={dataQuery}
  empty={<EmptyState icon={Inbox} title={t("feature:noData")} />}
>
  {(data) => <DataTable data={data} />}
</QueryState>
```

### Stat Dashboard Pattern

```tsx
<DataCardGrid columns={4}>
  <StatCard label="Revenue" value={formatCurrency(stats.revenue)} icon={DollarSign} />
  <StatCard label="Orders" value={stats.orders} icon={ShoppingCart} trend={{ value: 12, direction: 'up' }} />
</DataCardGrid>
```

---

## 4. State Patterns

### Loading State
- Use `Skeleton` component from Shadcn for placeholder loading
- `QueryState` automatically renders loading skeletons (3 bars by default)
- `StatCard` has built-in `loading` prop that shows skeleton variant

### Error State
- `QueryState` renders a styled error message with retry button
- Error displays use `text-destructive` and `bg-destructive/5`
- Retry button calls `query.refetch()` automatically

### Empty State
- Use `EmptyState` component for all no-data scenarios
- Always provide an icon, title, and optional description + action button
- Never use bare text like "No data found"

---

## 5. Navigation Patterns

### Sidebar Groups

5 collapsible groups (sourced from `lib/nav-config.ts`):
1. **Daily Operations** (default open): Dashboard, Queue, Waitlist, POS, Transactions, Cash Drawer
2. **Staff & HR**: Barbers, Attendance, Commissions, Payroll
3. **Products & Services**: Inventory, Services
4. **Customer Engagement**: Reviews, Loyalty, Campaigns, CRM, Retention, Notifications
5. **Administration**: Analytics, Reports, Users, Audit, Finance, Settings, Branches

Group open/close state persists to `localStorage` (`tmng-sidebar-groups`). Active route auto-expands its parent group. RBAC filtering hides items without permission.

### Breadcrumb Mapping

Auto-generated from `useLocation()` + `getRouteLabel()` in nav-config. Pattern: `Home / {Group} / {Page}`. Home always links to `/`. Group is informational (not a link). Current page is non-linked.

### Command Palette

`Ctrl+K` / `Cmd+K` opens the command palette. Sections: Pages (RBAC-filtered), grouped by nav-config categories. Fuzzy search via cmdk. Selecting navigates via React Router.

---

## 6. i18n Conventions

### Namespace Structure
Each feature has its own namespace: `queue`, `pos`, `transactions`, `inventory`, `analytics`, etc.
- Shared keys: `common` namespace
- Sidebar keys: `sidebar` namespace
- Each namespace has both `en` and `id` locale files

### Key Naming
- camelCase: `noDataFound`, `loadingText`, `pageTitle`
- Action keys prefixed with verb: `createNew`, `deleteConfirm`, `saveChanges`
- Status keys: `statusActive`, `statusPending`, `statusCompleted`

### Rules
- Every user-visible string MUST use `t()` — no hardcoded text
- Feature-specific text: `t("queue:title")`
- Shared text: `t("common:save")`

---

## 7. File Organization

### Composite Components
All design system composites live in `apps/admin/src/components/ui/`:
- `page-header.tsx`, `page-container.tsx`, `query-state.tsx`
- `stat-card.tsx`, `empty-state.tsx`, `status-badge.tsx`, `data-card-grid.tsx`

### Layout Components
Shell components live in `apps/admin/src/components/layout/`:
- `admin-layout.tsx` — main shell composing sidebar + topbar + content
- `sidebar.tsx`, `sidebar-group.tsx`, `sidebar-nav-item.tsx` — grouped navigation
- `topbar.tsx`, `breadcrumbs.tsx`, `command-menu.tsx`, `notification-bell.tsx`, `profile-dropdown.tsx`

### Shared Config
- `apps/admin/src/lib/nav-config.ts` — navigation structure (groups, items, routes, icons, RBAC)
- `apps/admin/src/lib/utils.ts` — `cn()`, `formatCurrency()`, `formatDate()`, `formatRelativeTime()`, `getInitials()`, `formatNumber()`

### Shadcn Primitives (27 total)
Pre-installed in `apps/admin/src/components/ui/`: skeleton, dropdown-menu, popover, command, breadcrumb, collapsible, avatar, sheet, tooltip, separator, scroll-area, alert, dialog, badge, button, card, form, input, label, select, native-select, switch, table, tabs, textarea, image-upload
