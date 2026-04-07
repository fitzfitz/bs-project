---
trigger: model_decision
description: Visual consistency enforcement for admin and client apps
globs: apps/admin/src/**,apps/client/src/**
---

# Style Discipline Rules

**Reference:** `docs/design_system.md`

## CSS Framework

- Tailwind CSS only — no custom CSS unless impossible with Tailwind utilities.
- Never use inline `style` attributes for layout or theming (only for truly dynamic values like calculated positions).

## Spacing

- Page-level spacing: `space-y-6` (enforced by PageContainer)
- Section-level spacing: `space-y-4`
- Row gaps: `gap-4` for flex/grid rows
- Page padding: `p-6` (enforced by AdminLayout main area)

## Typography

Use ONLY the defined scale from the design system:
- Page titles: handled by `PageHeader` (`text-2xl font-semibold tracking-tight`)
- Section titles: `text-lg font-semibold`
- Card titles: `text-sm font-medium`
- Body text: `text-sm`
- Captions: `text-xs text-muted-foreground`

## Colors

- Use semantic tokens only: `primary`, `destructive`, `success`, `warning`, `info`, `muted`
- Never use raw Tailwind colors (no `text-red-500` — use `text-destructive`)
- Never use hardcoded hex values in component files — all colors come from CSS variables in `index.css`

## Elevation

- Cards: `shadow-sm`
- Dropdowns/popovers: `shadow-md`
- Modals/dialogs: `shadow-lg`
- Never use arbitrary shadow values except the topbar pattern

## Border Radius

- Use theme-defined radius: `rounded-lg` (default), `rounded-xl` (larger cards), `rounded-full` (avatars/badges)
- Never use arbitrary radius values like `rounded-[12px]`

## Icons

- Icon library: `lucide-react` only
- Standard sizes: `h-4 w-4` (inline/buttons), `h-[18px] w-[18px]` (nav items), `h-5 w-5` (section headers), `h-6 w-6` (empty state decorative)

## Internationalization

- Every user-visible string MUST use i18n `t()` calls — never hardcoded text
- Feature text: `t("feature:key")` — namespace matches directory name
- Shared text: `t("common:key")`
- Both `en` and `id` locale files must be updated together

## Layout

- Every page MUST be wrapped in `PageContainer`
- Every page MUST use `PageHeader` for its title
- Branch-scoped pages MUST include `BranchSelector` in the PageHeader actions slot