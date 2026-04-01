# Feature: Design System Foundation

## Overview

Establishes the foundational design token layer and installs all required Shadcn primitive components for the admin UI redesign. This sprint is pure infrastructure — no visual changes for end users.

## Theme Token Extensions

### Semantic Status Colors

Added to `apps/admin/src/app/index.css` alongside existing Shadcn tokens:

| Token | Value | Purpose |
|-------|-------|---------|
| `--success` | `#22c55e` | Positive states (completed, approved, online) |
| `--success-foreground` | `#ffffff` | Text on success backgrounds |
| `--warning` | `#f59e0b` | Caution states (low stock, expiring, pending) |
| `--warning-foreground` | `#ffffff` | Text on warning backgrounds |
| `--info` | `#3b82f6` | Informational states (in-progress, queued) |
| `--info-foreground` | `#ffffff` | Text on info backgrounds |

These must also be registered in `@theme inline` as `--color-success`, `--color-success-foreground`, etc. so Tailwind v4 can generate `bg-success`, `text-success-foreground`, etc.

### Typography Scale (Tailwind class conventions)

| Role | Classes | Usage |
|------|---------|-------|
| Page Title | `text-2xl font-semibold tracking-tight text-foreground` | PageHeader component |
| Section Title | `text-lg font-semibold text-foreground` | Card/form section titles |
| Card Title | `text-sm font-medium text-foreground` | Stat card labels, table headers |
| Body | `text-sm text-foreground` | Default body text |
| Caption | `text-xs text-muted-foreground` | Timestamps, helper text |
| Badge Text | `text-[11px] font-medium` | Status/role/count badges |
| Nav Item | `text-[13px] font-medium` | Sidebar nav labels |
| Group Label | `text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground` | Sidebar group headers |

### Spacing Standard

| Level | Value | Usage |
|-------|-------|-------|
| Page-level | `space-y-6` | Between page sections |
| Section-level | `space-y-4` | Between items within a section |
| Component-level | `space-y-2` / `gap-2` | Within a component |
| Row gaps | `gap-4` | Flex/grid row items |
| Page padding | `p-6` | Main content area |

### Elevation Scale

| Level | Class | Usage |
|-------|-------|-------|
| Card | `shadow-sm` | Cards, stat cards |
| Dropdown | `shadow-md` | Dropdown menus, popovers |
| Modal | `shadow-lg` | Dialogs, command palette |
| Topbar | `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` | Header bar |

## Shadcn Components to Install

12 new components:

1. `skeleton` — Loading placeholders
2. `dropdown-menu` — Profile dropdown, context menus
3. `popover` — Notification bell panel
4. `command` — Command palette (Ctrl+K)
5. `breadcrumb` — Navigation breadcrumbs
6. `collapsible` — Sidebar group expand/collapse
7. `avatar` — User display
8. `sheet` — Mobile sidebar overlay
9. `tooltip` — Collapsed sidebar icon hints
10. `separator` — Visual dividers
11. `scroll-area` — Sidebar scroll container
12. `alert` — Inline warnings/info messages

Install command: `pnpm --filter @tmng/barber-admin dlx shadcn@latest add <name>`

## Success Criteria

- All 12 Shadcn components installed in `src/components/ui/` and importable
- Theme tokens added to both `@theme inline` and `:root` in index.css
- Tailwind generates `bg-success`, `text-success-foreground`, `bg-warning`, `text-warning-foreground`, `bg-info`, `text-info-foreground` utility classes
- `docs/design_system.md` updated with populated theme token reference
- Smoke tests verify all components render without errors
- `pnpm --filter @tmng/barber-admin lint` — zero errors
- `pnpm --filter @tmng/barber-admin typecheck` — zero errors
- `pnpm --filter @tmng/barber-admin test` — all passing
