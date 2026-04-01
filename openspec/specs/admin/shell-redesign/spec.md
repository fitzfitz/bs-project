# Feature: Admin Shell Redesign

## Overview

Complete redesign of the admin dashboard shell: grouped collapsible sidebar, feature-rich topbar with command palette, notification bell, profile dropdown, breadcrumbs, and branch selector.

## Sidebar (Sprint 2.1)

### Navigation Structure

5 collapsible groups sourced from `lib/nav-config.ts`:
1. **Daily Operations** (default open): Dashboard, Queue, Waitlist, POS, Transactions, Cash Drawer
2. **Staff & HR**: Barbers, Attendance, Commissions, Payroll
3. **Products & Services**: Inventory, Services
4. **Customer Engagement**: Reviews, Loyalty, Campaigns, CRM, Retention, Notifications
5. **Administration**: Analytics, Reports, Users, Audit, Finance, Config, Branches

Barber portal: flat 4-item list (Dashboard, My Schedule, My Commissions, My Attendance).

### Components

**SidebarGroup** (`components/layout/sidebar-group.tsx`):
- Props: `label`, `icon`, `children`, `defaultOpen?`, `isOpen`, `onToggle`
- Uses Shadcn `Collapsible`
- Chevron rotates on expand/collapse

**SidebarNavItem** (`components/layout/sidebar-nav-item.tsx`):
- Props: `to`, `label`, `icon`, `badge?`, `collapsed?`
- Active state: `bg-primary/10` with left accent bar
- Tooltip on icon when sidebar is collapsed

**Sidebar** (`components/layout/sidebar.tsx`):
- Reads groups from nav-config
- Filters by RBAC using `hasAnyPermission`
- Persists group open/closed state in localStorage (`tmng-sidebar-groups`)
- Active item auto-expands parent group
- Collapsed mode: icon-only with tooltips

## Topbar (Sprint 2.2)

**Breadcrumbs** (`components/layout/breadcrumbs.tsx`):
- Auto-generated from `useLocation()` + `getRouteLabel()`
- Pattern: Home / Group / Page
- Uses Shadcn `Breadcrumb`

**ProfileDropdown** (`components/layout/profile-dropdown.tsx`):
- Avatar with initials + user name
- Dropdown: full name, email, role badge, language toggle, settings link, logout
- Uses Shadcn `DropdownMenu` + `Avatar`

**Topbar** (`components/layout/topbar.tsx`):
- Left: sidebar toggle + breadcrumbs
- Right: search trigger + branch selector + sync indicator + notification bell + profile dropdown

## Command Palette (Sprint 2.3)

**CommandMenu** (`components/layout/command-menu.tsx`):
- Ctrl+K / Cmd+K to open
- Sections: Pages (RBAC-filtered), Quick Actions, Recent
- Fuzzy search via cmdk
- Uses Shadcn `Command` in a dialog

## Notification Bell (Sprint 2.4)

**NotificationBell** (`components/layout/notification-bell.tsx`):
- Bell icon with unread badge
- Popover with 5 recent notifications
- Uses `useNotificationStats()` + `useNotificationAdminList()`
- Only shown with CAMPAIGNS permission

## Favorites (Sprint 2.4)

**FavoritesStore** (`store/use-favorites-store.ts`):
- Zustand + localStorage persistence
- Max 6 pins, role-aware defaults

**SidebarFavorites** (`components/layout/sidebar-favorites.tsx`):
- Renders pinned items above nav groups

## Success Criteria

- Sidebar shows grouped navigation for all role types
- RBAC filtering works correctly
- Group collapse/expand persists across page loads
- Active route auto-expands parent group
- Breadcrumbs reflect current location
- Profile dropdown shows user info and allows logout/language switch
- Command palette searches pages by permission
- Notification bell shows unread count
- All tests pass, lint + typecheck green
