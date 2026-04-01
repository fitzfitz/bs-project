# Admin UI Redesign — Sprint Plan

> **Created:** Mar 28, 2026
> **Status:** Complete — All 12 sprints done
> **Completed:** Mar 28, 2026
> **Scope:** 12 sprints across 4 phases
> **Apps affected:** `@tmng/barber-admin` (primary), design system will later extend to `@tmng/barber-client`

---

## Objectives

1. **Design System Foundation** — Establish reusable theme tokens, composite components, and shared patterns that enforce visual and behavioral consistency across every page.
2. **Shell & Navigation Redesign** — Replace the flat sidebar + bare header with a grouped collapsible sidebar, command palette, notification bell, profile dropdown, breadcrumbs, and branch selector.
3. **Page Consistency** — Migrate all 27 admin pages to use the design system, eliminating ad-hoc patterns and i18n gaps.
4. **Documentation & Rules** — Produce a living design system document and Cursor rules (`design-system.mdc`, `style-discipline.mdc`) that are reusable across the client app.

## Cross-Cutting Principles

Every sprint follows the **workflow gate** without exception:

```
Spec -> Tests (TDD) -> Implement -> Verify (lint + typecheck + test)
```

**Definition of Done** (applies to every sprint):
- [x] OpenSpec `spec.md` written/updated for the sprint scope
- [x] All unit/component tests written and passing
- [x] `pnpm --filter @tmng/barber-admin lint` — zero errors
- [x] `pnpm --filter @tmng/barber-admin typecheck` — zero errors
- [x] `pnpm --filter @tmng/barber-admin test` — all passing
- [x] `docs/design_system.md` updated if new tokens/components were added
- [x] No regressions in existing tests

---

## Phase Dependencies

```
Phase 1 (Foundation) ──► Phase 2 (Shell Redesign)
       │                         │
       └────────► Phase 3 (Page Migration) ◄──┘
                         │
                  Phase 4 (Polish & Docs)
```

- Phase 2 and Phase 3 both depend on Phase 1 being complete.
- Phase 3 depends on Phase 2 (nav-config, breadcrumbs).
- Phase 4 depends on Phase 3.

---

## Phase 1: Design System Foundation

### Sprint 1.1 — Theme Tokens & Shadcn Primitives

**Objective:** Establish the design token layer and install all Shadcn base components needed across the entire redesign. Nothing visual changes for end users — this is pure infrastructure.

**Spec:** `openspec/specs/admin/design-system-foundation/spec.md`

**Deliverables:**

- Extended theme tokens in `apps/admin/src/app/index.css`:
  - Semantic status colors: `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--info`, `--info-foreground`
  - Documented Tailwind class conventions for typography, spacing, elevation (in design_system.md)
- 12 new Shadcn components installed in `apps/admin/src/components/ui/`:
  - `skeleton`, `dropdown-menu`, `popover`, `command`, `breadcrumb`, `collapsible`, `avatar`, `sheet`, `tooltip`, `separator`, `scroll-area`, `alert`
- Initial `docs/design_system.md` with theme token reference

**Test Requirements:**
- Verify all installed Shadcn components render without errors (smoke tests)
- Verify extended CSS variables resolve correctly

**Verification Checklist:**
- [x] All 12 Shadcn components installed and importable
- [x] Theme tokens added to index.css
- [x] `docs/design_system.md` has theme tokens section
- [x] lint + typecheck + test = zero errors

---

### Sprint 1.2 — Core Composite Components

**Objective:** Build the three most impactful composite components that will be used on every single page.

**Spec:** `openspec/specs/admin/design-system-composites/spec.md` (core section)

**Deliverables:**

- `apps/admin/src/components/ui/page-header.tsx`
  - Props: `title: string`, `description?: string`, `actions?: ReactNode`, `badge?: ReactNode`
  - Renders standardized page title bar with consistent typography (`text-2xl font-semibold tracking-tight`)
  - Right-aligned action slot for buttons, filters, branch selector
  - Replaces 27 different ad-hoc `<h1>` patterns

- `apps/admin/src/components/ui/page-container.tsx`
  - Props: `children: ReactNode`, `className?: string`
  - Enforces consistent page-level spacing (`space-y-6`)
  - Standardizes the outer wrapper every page uses

- `apps/admin/src/components/ui/query-state.tsx`
  - Props: `query: UseQueryResult`, `empty?: ReactNode | ((data) => boolean)`, `loadingFallback?: ReactNode`, `errorFallback?: ReactNode`, `children: (data: T) => ReactNode`
  - Handles loading → skeleton, error → error display, empty → empty state, success → render children
  - Wraps TanStack Query results with zero boilerplate in consuming components

**Test Requirements (per component):**
- PageHeader: renders title, renders with description, renders with actions slot, renders with badge, applies correct typography classes
- PageContainer: renders children with correct spacing class, accepts custom className
- QueryState: renders loading fallback during loading, renders error fallback on error, renders empty state when data is empty, renders children with data on success, handles undefined data gracefully

**Verification Checklist:**
- [x] All three components implemented and exported
- [x] All component tests pass
- [x] `docs/design_system.md` updated with component API reference
- [x] lint + typecheck + test = zero errors

---

### Sprint 1.3 — Extended Composites & Shared Utilities

**Objective:** Complete the design system component library and establish shared utility functions and the centralized navigation config.

**Spec:** `openspec/specs/admin/design-system-composites/spec.md` (extended section)

**Deliverables:**

- `apps/admin/src/components/ui/stat-card.tsx`
  - Props: `label: string`, `value: string | number`, `icon?: LucideIcon`, `trend?: { value: number; direction: 'up' | 'down' }`, `loading?: boolean`, `className?: string`
  - Card with icon, primary value, label, optional trend indicator
  - Loading state shows Skeleton variant
  - Replaces local StatCard in dashboard-overview.tsx and loyalty page

- `apps/admin/src/components/ui/empty-state.tsx`
  - Props: `icon?: LucideIcon`, `title: string`, `description?: string`, `action?: ReactNode`
  - Centered column layout with icon, heading, description, optional CTA button
  - Replaces scattered inline "No data found" patterns

- `apps/admin/src/components/ui/status-badge.tsx`
  - Props: `variant: 'success' | 'warning' | 'error' | 'info' | 'default'`, `children: ReactNode`
  - Semantic colored badge for statuses across queue, transactions, attendance
  - Uses the new status color tokens from Sprint 1.1

- `apps/admin/src/components/ui/data-card-grid.tsx`
  - Props: `children: ReactNode`, `columns?: 2 | 3 | 4`
  - Responsive grid layout for stat cards
  - Replaces repeated `grid grid-cols-2 lg:grid-cols-4 gap-4` patterns

- Extended `apps/admin/src/lib/utils.ts`:
  - `formatDate(date: string | Date, style?: 'short' | 'long' | 'relative'): string`
  - `formatRelativeTime(date: string | Date): string` — "2 hours ago", "yesterday"
  - `getInitials(firstName: string, lastName?: string): string` — for Avatar
  - `formatNumber(n: number, locale?: string): string` — locale-aware number formatting

- `apps/admin/src/lib/nav-config.ts` (new file):
  - Centralized navigation config: groups, items, icons, i18n keys, routes, RBAC feature codes
  - Typed as `NavGroup[]` with `NavItem[]` children
  - Single source of truth consumed by sidebar (Phase 2), command palette (Phase 2), and breadcrumbs (Phase 2)
  - Includes route-to-label mapping for breadcrumb generation
  - Includes barber portal nav as a separate config

**Test Requirements:**
- StatCard: renders value/label, renders with icon, renders with trend (up/down arrows), shows skeleton when loading
- EmptyState: renders icon + title + description, renders with action button, renders without optional props
- StatusBadge: renders each variant with correct color classes
- DataCardGrid: renders correct grid columns for each column prop
- Utils: formatDate outputs correct formats, formatRelativeTime handles edge cases (just now, minutes, hours, days), getInitials handles single/double names, formatNumber handles large numbers and locales
- NavConfig: exports valid group structure, all nav items have required fields, route-to-label mapping covers all routes

**Verification Checklist:**
- [x] All four components implemented and exported
- [x] All utility functions implemented and tested
- [x] nav-config.ts created with full navigation structure
- [x] `docs/design_system.md` updated with all component APIs and utility reference
- [x] lint + typecheck + test = zero errors
- [x] No existing tests broken

---

## Phase 2: Shell & Navigation Redesign

### Sprint 2.1 — Sidebar Rewrite

**Objective:** Replace the flat 25-item sidebar with a grouped, collapsible navigation using the nav-config from Phase 1.

**Spec:** `openspec/specs/admin/shell-redesign/spec.md` (sidebar section)

**Deliverables:**

- `apps/admin/src/components/layout/sidebar-group.tsx`
  - Collapsible group header with chevron icon, smooth 200ms animation
  - Uses Shadcn `Collapsible` component
  - Accepts: `label: string`, `icon: LucideIcon`, `children: ReactNode`, `defaultOpen?: boolean`

- `apps/admin/src/components/layout/sidebar-nav-item.tsx`
  - Single nav link with icon, label, optional badge count
  - Active state with left accent bar (preserves existing pattern)
  - Tooltip when sidebar is collapsed
  - Accepts: `to: string`, `label: string`, `icon: LucideIcon`, `badge?: number`, `collapsed?: boolean`

- Rewritten `apps/admin/src/components/layout/sidebar.tsx`
  - Consumes nav-config.ts for group/item definitions
  - 5 collapsible groups: Daily Operations, Staff & HR, Products & Services, Customer Engagement, Administration
  - Daily Operations expanded by default, others collapsed
  - Collapse state persisted in localStorage (key: `tmng-sidebar-groups`)
  - Active item auto-expands its parent group on navigation
  - RBAC filtering: items hidden if user lacks permission (existing behavior, now using nav-config)
  - Barber portal: flat 4-item list (no groups needed)
  - ScrollArea for nav section
  - Collapsed mode: icon-only with Tooltip on hover

- i18n additions (`en/sidebar.json`, `id/sidebar.json`):
  - Group labels: `dailyOperations`, `staffHr`, `productsServices`, `customerEngagement`, `administration`
  - Favorites label: `favorites`

**Test Requirements:**
- SidebarGroup: renders expanded by default, collapses on header click, persists state to localStorage, auto-expands when child is active
- SidebarNavItem: renders icon + label, shows active state for matching route, shows badge count when provided, shows tooltip when collapsed
- Sidebar: renders all groups for HQ user, filters items by RBAC permissions, renders barber portal for staff with staffProfile, persists collapse state across remounts, active route expands parent group

**Verification Checklist:**
- [x] Sidebar renders grouped navigation correctly
- [x] Collapse/expand works with persistence
- [x] RBAC filtering works for all permission combinations
- [x] Barber portal renders correctly
- [x] Collapsed mode shows tooltips
- [x] All sidebar tests pass
- [x] lint + typecheck + test = zero errors

---

### Sprint 2.2 — Topbar Core (Breadcrumbs & Profile Dropdown)

**Objective:** Build the topbar foundation with breadcrumbs for spatial awareness and a profile dropdown replacing the static user display.

**Spec:** `openspec/specs/admin/shell-redesign/spec.md` (topbar section)

**Deliverables:**

- `apps/admin/src/components/layout/breadcrumbs.tsx`
  - Auto-generated from `useLocation()` + nav-config route-to-label mapping
  - Uses Shadcn `Breadcrumb` component
  - Pattern: `Home / {Group Name} / {Page Name}`
  - "Home" is always first, links to `/`
  - Group name is informational (not a link)
  - Current page is non-linked text
  - Falls back to capitalized route segment if not in nav-config

- `apps/admin/src/components/layout/profile-dropdown.tsx`
  - Trigger: Avatar (initials via `getInitials()`) + user name
  - Uses Shadcn `DropdownMenu` + `Avatar`
  - Header section: full name, email, role badge with scope color (HQ = amber, BRANCH = blue), branch name if applicable
  - Actions: Language toggle (EN/ID), Settings link → `/config`, Keyboard shortcuts info
  - Footer: Logout button with red styling
  - Replaces: static header user block + sidebar bottom "Logged in as" card + bare logout button

- `apps/admin/src/components/layout/topbar.tsx`
  - Left: sidebar collapse toggle (existing) + Breadcrumbs
  - Right: (placeholder slots for command palette & notification bell) + SyncIndicator + ProfileDropdown
  - Height: 56px, preserves glass-morphism backdrop
  - Extracted from current admin-layout.tsx header

- Updated `apps/admin/src/components/layout/admin-layout.tsx`
  - Composes: OfflineBanner + Sidebar + Topbar + main content
  - Removes inline header markup (now in Topbar)
  - Removes sidebar bottom user card (now in ProfileDropdown)

- i18n additions:
  - `en/common.json` / `id/common.json`: `profile`, `settings`, `logout`, `keyboardShortcuts`, `language`, `home` (breadcrumb root)

**Test Requirements:**
- Breadcrumbs: renders "Home" for root route, renders group + page for nested route, handles unknown routes gracefully, links are clickable
- ProfileDropdown: renders avatar with correct initials, shows user name and role, language toggle switches language, settings link navigates to /config, logout calls clearSession
- Topbar: renders collapse toggle, renders breadcrumbs, renders profile dropdown, renders sync indicator
- AdminLayout: composes sidebar + topbar + outlet correctly

**Verification Checklist:**
- [x] Breadcrumbs show correct path for all routes
- [x] Profile dropdown shows complete user info
- [x] Language toggle works
- [x] Logout clears session and redirects
- [x] Admin layout composes correctly
- [x] All tests pass
- [x] lint + typecheck + test = zero errors

---

### Sprint 2.3 — Command Palette

**Objective:** Add a global search/command palette (Ctrl+K) that lets users navigate to any page or trigger quick actions instantly.

**Spec:** `openspec/specs/admin/shell-redesign/spec.md` (command palette section)

**Deliverables:**

- `apps/admin/src/components/layout/command-menu.tsx`
  - Uses Shadcn `Command` component (wraps cmdk library)
  - Triggered by: Ctrl+K (Windows) / Cmd+K (Mac), or clicking the search trigger in topbar
  - Renders as a centered dialog overlay

  - **Sections:**
    - **Pages** — all nav items from nav-config, filtered by user's RBAC permissions, grouped by category, showing icon + label + group name
    - **Quick Actions** — contextual shortcuts: "New Walk-In" (→ queue), "Open Cash Drawer" (→ cash drawer), "New Transaction" (→ POS)
    - **Recent** — last 5 visited pages (stored in sessionStorage)

  - **Behavior:**
    - Fuzzy search across all entries (built into cmdk)
    - Arrow keys navigate results, Enter selects, Escape closes
    - Selecting a page navigates via React Router
    - Selecting an action navigates to the relevant page
    - Dialog closes on selection or Escape

- Updated `topbar.tsx`:
  - Search trigger button: styled as a subtle input with ghost text "Search pages..." and Ctrl+K badge
  - Opens CommandMenu on click

- `apps/admin/src/hooks/use-recent-pages.ts` (new):
  - Tracks last 5 unique page visits in sessionStorage
  - Hook: `useRecentPages()` returns `{ recent: string[], addRecent: (path: string) => void }`
  - Called from AdminLayout on route change

**Test Requirements:**
- CommandMenu: opens on Ctrl+K keydown, closes on Escape, renders nav items filtered by permissions, fuzzy search filters results correctly, selecting an item navigates to the route, shows recent pages section
- useRecentPages: tracks page visits, deduplicates, limits to 5, persists in sessionStorage

**Verification Checklist:**
- [x] Ctrl+K opens command palette
- [x] Search filters results correctly
- [x] RBAC filtering hides unauthorized pages
- [x] Navigation works on item selection
- [x] Recent pages tracked and displayed
- [x] Keyboard navigation (arrow keys, Enter, Escape) works
- [x] All tests pass
- [x] lint + typecheck + test = zero errors

---

### Sprint 2.4 — Notification Bell, Favorites & Final Integration

**Objective:** Add the notification bell, favorites system, and complete the shell integration.

**Spec:** `openspec/specs/admin/shell-redesign/spec.md` (notifications, favorites sections)

**Deliverables:**

- `apps/admin/src/components/layout/notification-bell.tsx`
  - Bell icon with unread count badge (red dot with number)
  - Click opens Shadcn `Popover` panel:
    - Header: "Notifications" + "Mark all read" link
    - List: 5 most recent notifications (title, body preview, relative time, read/unread indicator)
    - Footer: "View All" link → `/notifications`
  - Uses existing `useNotificationStats()` for count and `useNotificationAdminList()` for items
  - Only rendered if user has CAMPAIGNS permission
  - Badge hidden when count is 0

- `apps/admin/src/store/use-favorites-store.ts` (new)
  - Zustand store with localStorage persistence (key: `tmng-sidebar-favorites`)
  - State: `pins: string[]` (route paths)
  - Actions: `togglePin(path)`, `isPinned(path)`, `reorderPins(pins)`
  - Max 6 pinned items, enforced on add
  - Role-aware defaults on first load:
    - HQ scope: `["/", "/analytics", "/queue"]`
    - BRANCH scope: `["/", "/queue", "/pos"]`
    - Barber: no favorites (flat nav)

- `apps/admin/src/components/layout/sidebar-favorites.tsx` (new)
  - Renders pinned items from favorites store
  - Each item shows icon + label (from nav-config lookup)
  - Subtle visual distinction (slightly warm background tint)
  - "Pin" / "Unpin" action accessible via right-click context menu on any sidebar nav item

- Updated `topbar.tsx`:
  - All slots now filled: collapse toggle + breadcrumbs + search trigger + branch selector + sync indicator + notification bell + profile dropdown

- Updated `sidebar.tsx`:
  - Favorites section rendered above nav groups
  - Context menu on nav items for pin/unpin

- i18n additions:
  - `en/common.json` / `id/common.json`: notification bell labels (`notifications`, `markAllRead`, `viewAll`, `noNotifications`), favorites labels (`pinToFavorites`, `unpinFromFavorites`)

**Test Requirements:**
- NotificationBell: renders bell icon, shows badge with unread count, hides badge when count is 0, popover shows recent notifications, "View All" navigates to /notifications, hidden when user lacks CAMPAIGNS permission
- FavoritesStore: initializes with role-aware defaults, togglePin adds/removes, enforces max 6, persists to localStorage
- SidebarFavorites: renders pinned items, items are clickable navigation links
- Integration: full admin layout renders sidebar + topbar + content area correctly, all interactive elements function

**Verification Checklist:**
- [x] Notification bell shows correct unread count
- [x] Notification popover displays recent items
- [x] Favorites section appears in sidebar with default pins
- [x] Pin/unpin works from sidebar context menu
- [x] All topbar elements render and function
- [x] Complete shell works end-to-end (sidebar + topbar + content)
- [x] All tests pass
- [x] lint + typecheck + test = zero errors

---

## Phase 3: Page Consistency Migration

### Sprint 3.1 — High-Traffic Pages

**Objective:** Migrate the 5 most-used pages to the design system. These are the pages staff interact with hourly.

**Spec:** `openspec/specs/admin/page-migration/spec.md` (high-traffic section)

**Pages:**
1. `pages/dashboard/page.tsx` — Use PageContainer, replace local StatCard with shared StatCard + DataCardGrid
2. `pages/queue/page.tsx` — Use PageContainer + PageHeader (title, branch selector, date picker, walk-in button in actions slot), replace custom loading skeleton with QueryState
3. `pages/pos/page.tsx` — Use PageContainer + PageHeader, standardize loading/empty patterns
4. `pages/transactions/page.tsx` — Use PageContainer + PageHeader, wrap table in QueryState, use EmptyState for no results
5. `pages/cash-drawer/page.tsx` — Use PageContainer + PageHeader, standardize states

**Migration Pattern (applied to each page):**
1. Wrap page content in `<PageContainer>`
2. Replace ad-hoc `h1` + flex row with `<PageHeader title={t("feature:title")} actions={...} />`
3. Replace inline loading checks with `<QueryState query={...}>`
4. Replace inline "No data" text with `<EmptyState>`
5. Replace local StatCard definitions with shared `<StatCard>`
6. Fix any hardcoded English strings → `t()` calls
7. Verify spacing is consistent (`space-y-6` page-level, `space-y-4` section-level)

**Test Requirements:**
- Each migrated page renders correctly with PageHeader
- Loading states show appropriate skeletons
- Error states display error messages
- Empty states show EmptyState component
- No regressions in existing widget tests

**Verification Checklist:**
- [x] All 5 pages use PageContainer + PageHeader
- [x] All query-dependent sections wrapped in QueryState
- [x] No hardcoded English strings remain on these pages
- [x] Visual consistency confirmed across all 5 pages
- [x] All tests pass
- [x] lint + typecheck + test = zero errors

---

### Sprint 3.2 — Operations & Staff Pages

**Objective:** Migrate the 7 operational and staff management pages.

**Spec:** `openspec/specs/admin/page-migration/spec.md` (operations section)

**Pages:**
1. `pages/inventory/page.tsx`
2. `pages/services/page.tsx` — fix `tracking-tight` inconsistency
3. `pages/barbers/page.tsx`
4. `pages/attendance/page.tsx`
5. `pages/commissions/page.tsx`
6. `pages/payroll/page.tsx`
7. `pages/branches/page.tsx`

**Same migration pattern as Sprint 3.1.**

Additional focus:
- Fix services page title inconsistency (`tracking-tight` vs standard)
- Ensure BranchSelector is present on all branch-scoped pages
- Standardize tab patterns (inventory, reports use Tabs — verify consistent styling)

**Test Requirements:**
- Same as Sprint 3.1 applied to each page
- BranchSelector presence verified on branch-scoped pages

**Verification Checklist:**
- [x] All 7 pages migrated to design system components
- [x] Typography and spacing fully consistent
- [x] BranchSelector on all branch-scoped pages
- [x] All tests pass
- [x] lint + typecheck + test = zero errors

---

### Sprint 3.3 — Admin, Engagement & Remaining Pages

**Objective:** Complete page migration for all remaining pages including admin, engagement, and barber portal.

**Spec:** `openspec/specs/admin/page-migration/spec.md` (admin + engagement section)

**Pages (15 total):**

Admin:
1. `pages/analytics/page.tsx` — fix hardcoded "Analytics" title
2. `pages/reports/page.tsx`
3. `pages/finance/page.tsx`
4. `pages/users/page.tsx` — fix hardcoded "User Management" title
5. `pages/audit/page.tsx`
6. `pages/config/page.tsx`

Engagement:
7. `pages/crm/page.tsx` — fix hardcoded "Customer Insights" title
8. `pages/loyalty/page.tsx` — replace local StatCard, standardize spacing from `space-y-6`
9. `pages/campaigns/page.tsx`
10. `pages/retention/page.tsx`
11. `pages/reviews/page.tsx`
12. `pages/notifications/page.tsx`
13. `pages/waitlist/page.tsx`

Barber Portal:
14. `pages/barber-portal/my-schedule.tsx`
15. `pages/barber-portal/my-commissions.tsx`
16. `pages/barber-portal/my-attendance.tsx`

**Same migration pattern as Sprint 3.1.**

Additional focus:
- Fix all remaining hardcoded English strings (analytics, users, CRM)
- Ensure barber portal pages also use PageContainer + PageHeader for consistency
- Final i18n audit: every user-visible string uses `t()` calls
- Review all feature widgets for consistent QueryState usage

**Test Requirements:**
- Same as Sprint 3.1 applied to each page
- i18n: verify no hardcoded strings remain in any page file

**Verification Checklist:**
- [x] All 15 pages migrated to design system components
- [x] Zero hardcoded English strings across ALL 27 pages
- [x] Barber portal pages consistent with admin pages
- [x] All feature widgets use QueryState where applicable
- [x] All tests pass
- [x] Full regression test: lint + typecheck + test = zero errors across entire app

---

## Phase 4: Polish & Documentation

### Sprint 4.1 — Micro-Interactions & Accessibility

**Objective:** Add professional-grade animations and ensure the admin dashboard meets accessibility standards.

**Spec:** `openspec/specs/admin/polish/spec.md`

**Deliverables:**

Micro-interactions:
- Sidebar group collapse/expand: 200ms `ease-out` height animation (via Collapsible)
- Notification popover: fade-in + subtle scale transform from bell origin
- Command palette: fade-in + slide-up from center
- Nav item hover: 150ms background-color transition
- Page transition: subtle opacity fade on route change (optional, assess performance)
- Profile dropdown: standard Radix animation (built into DropdownMenu)
- Badge count: pulse animation when count changes

Keyboard navigation:
- `Ctrl+K` / `Cmd+K` → command palette (implemented in Sprint 2.3, verify here)
- `Escape` → close any open popover/dialog/command
- `Tab` order: topbar items flow left-to-right logically
- Sidebar: focusable nav items, arrow keys within groups

Accessibility:
- All interactive elements have `aria-label` or associated visible labels
- `aria-expanded` on collapsible sidebar groups
- `role="navigation"` on sidebar, `role="banner"` on topbar
- Focus rings visible on keyboard navigation (Tailwind `focus-visible:ring-2`)
- Color contrast: all text meets WCAG AA (4.5:1 normal, 3:1 large)
- Screen reader: notification count announced on change (`aria-live="polite"`)
- Skip-to-content link for keyboard users

**Test Requirements:**
- Keyboard: Ctrl+K opens command palette, Escape closes open elements, Tab order is correct
- Accessibility: key elements have correct ARIA attributes, focus management works on dialog open/close

**Verification Checklist:**
- [x] All animations render smoothly (no jank)
- [x] Keyboard navigation works for all interactive elements
- [x] ARIA attributes present on all required elements
- [x] Focus management correct for dialogs/popovers
- [x] Color contrast meets WCAG AA
- [x] All tests pass
- [x] lint + typecheck + test = zero errors

---

### Sprint 4.2 — Design System Documentation & Cursor Rules

**Objective:** Finalize the living design system document and create Cursor rules that enforce design consistency for both admin and (future) client apps.

**Spec:** N/A (this sprint IS the documentation)

**Deliverables:**

1. **Complete `docs/design_system.md`** (finalized from incremental updates):
   - Theme token reference (colors, typography, spacing, elevation, radius)
   - Component catalog (every composite component with props, usage examples, do/don't)
   - Page layout patterns (standard page structure with code examples)
   - State patterns (loading, error, empty — with visual examples in code)
   - Navigation patterns (sidebar groups, breadcrumb mapping, command palette)
   - i18n conventions (namespace structure, key naming)
   - Naming conventions and file organization rules

2. **`.cursor/rules/design-system.mdc`** (new Cursor rule):
   - Enforces use of design system components (PageHeader over ad-hoc h1, QueryState over manual loading checks, EmptyState over inline text)
   - Lists all available composite components with when-to-use guidance
   - Theme token usage rules (use CSS variables, not hardcoded colors)
   - Component import paths
   - Glob: `apps/admin/**`, `apps/client/**`

   Rough outline of what this rule will enforce:
   - MUST use `PageHeader` for all page titles — never ad-hoc `<h1>`
   - MUST use `PageContainer` as the outermost wrapper in every page
   - MUST use `QueryState` for any TanStack Query-dependent UI — never manual `if (isLoading)` checks
   - MUST use `EmptyState` for no-data displays — never inline "No data" text
   - MUST use `StatCard` for metric displays — never local card components
   - MUST use `StatusBadge` for status indicators — never ad-hoc colored badges
   - MUST use theme CSS variables for colors — never hardcoded hex values outside index.css
   - MUST use the typography scale classes documented in design_system.md

3. **`.cursor/rules/style-discipline.mdc`** (new Cursor rule):
   - Visual consistency enforcement across all apps
   - Glob: `apps/admin/**`, `apps/client/**`

   Rough outline of what this rule will enforce:
   - Tailwind only — no custom CSS unless impossible with Tailwind
   - Spacing: `space-y-6` page-level, `space-y-4` section-level, `gap-4` for flex/grid rows
   - Typography: use only the defined scale (text-2xl/semibold/tracking-tight for page titles, etc.)
   - Colors: semantic tokens only (primary, destructive, success, warning, info, muted) — never raw Tailwind colors (no `text-red-500`, use `text-destructive`)
   - Elevation: `shadow-sm` cards, `shadow-md` dropdowns, `shadow-lg` modals
   - Border radius: use theme `rounded-lg` / `rounded-xl` — never arbitrary values
   - Icons: lucide-react only, standard sizes (16px inline, 18px nav, 20px section headers)
   - All user-visible strings MUST use i18n `t()` — never hardcoded text
   - Every page MUST be wrapped in `PageContainer`

4. **Updated `docs/development_guide.md`**:
   - Add "Design System" section referencing `docs/design_system.md`
   - Add "UI Component Catalog" quick reference
   - Update verification workflow to include visual consistency check

5. **Updated `docs/gap_analysis.md`**:
   - Close any design-system-related gaps
   - Document any new gaps discovered during the redesign

**Verification Checklist:**
- [x] `docs/design_system.md` is complete with all sections
- [x] `.cursor/rules/design-system.mdc` created and enforces component usage
- [x] `.cursor/rules/style-discipline.mdc` created and enforces visual consistency
- [x] `docs/development_guide.md` updated with design system reference
- [x] `docs/gap_analysis.md` updated
- [x] Rules are testable: violating them produces clear guidance
- [x] Final full verification: lint + typecheck + test = zero errors across admin app

---

## Sprint Summary

| Sprint | Phase | Name | Key Deliverables | Est. Files |
|--------|-------|------|------------------|------------|
| 1.1 | Foundation | Theme & Primitives | Extended CSS tokens, 12 Shadcn components, initial design_system.md | ~15 |
| 1.2 | Foundation | Core Composites | PageHeader, PageContainer, QueryState | ~6 |
| 1.3 | Foundation | Extended Composites & Utils | StatCard, EmptyState, StatusBadge, DataCardGrid, utils, nav-config | ~10 |
| 2.1 | Shell | Sidebar Rewrite | Grouped collapsible sidebar, SidebarGroup, SidebarNavItem | ~6 |
| 2.2 | Shell | Topbar Core | Breadcrumbs, ProfileDropdown, Topbar, AdminLayout update | ~6 |
| 2.3 | Shell | Command Palette | CommandMenu, search trigger, useRecentPages | ~4 |
| 2.4 | Shell | Notifs, Favs & Integration | NotificationBell, FavoritesStore, SidebarFavorites, final wiring | ~6 |
| 3.1 | Migration | High-Traffic Pages | Dashboard, Queue, POS, Transactions, Cash Drawer | ~5+ widgets |
| 3.2 | Migration | Operations & Staff | Inventory, Services, Barbers, Attendance, Commissions, Payroll, Branches | ~7+ widgets |
| 3.3 | Migration | Admin & Engagement | Analytics, Reports, Finance, Users, Audit, Config, CRM, Loyalty, Campaigns, Retention, Reviews, Notifications, Waitlist, Barber Portal | ~15+ widgets |
| 4.1 | Polish | Interactions & A11y | Animations, keyboard nav, ARIA, focus management, contrast | ~10 |
| 4.2 | Polish | Docs & Rules | design_system.md, design-system.mdc, style-discipline.mdc, dev guide update | ~5 |

---

## Tracking

Progress will be tracked by marking sprints as:
- **Planned** — Sprint defined, not yet started
- **In Progress** — Spec written, actively working
- **In Review** — Implementation done, running verification
- **Done** — All DoD criteria met, verified green

| Sprint | Status | Completed |
|--------|--------|-----------|
| 1.1 | Done | Mar 28, 2026 |
| 1.2 | Done | Mar 28, 2026 |
| 1.3 | Done | Mar 28, 2026 |
| 2.1 | Done | Mar 28, 2026 |
| 2.2 | Done | Mar 28, 2026 |
| 2.3 | Done | Mar 28, 2026 |
| 2.4 | Done | Mar 28, 2026 |
| 3.1 | Done | Mar 28, 2026 |
| 3.2 | Done | Mar 28, 2026 |
| 3.3 | Done | Mar 28, 2026 |
| 4.1 | Done | Mar 28, 2026 |
| 4.2 | Done | Mar 28, 2026 |

## Completion Summary

All 12 sprints completed on Mar 28, 2026. Final metrics:

- **Admin test suite:** 33 files, 257 tests (up from 167 pre-redesign)
- **Lint:** 0 errors, 0 warnings
- **Typecheck:** 0 errors
- **Design system components:** 7 composites (PageHeader, PageContainer, QueryState, StatCard, EmptyState, StatusBadge, DataCardGrid)
- **Shadcn primitives installed:** 12 (skeleton, dropdown-menu, popover, command, breadcrumb, collapsible, avatar, sheet, tooltip, separator, scroll-area, alert)
- **Shell components:** sidebar (grouped, collapsible, RBAC-filtered), topbar (breadcrumbs, profile dropdown, command palette, notification bell, branch selector)
- **Pages migrated:** All 27 admin pages + 3 barber portal pages use PageContainer + PageHeader
- **Cursor rules created:** `design-system.mdc`, `style-discipline.mdc`
- **Docs updated:** `design_system.md`, `development_guide.md`, `gap_analysis.md`
