# Admin — Internationalization (i18n)

## Overview

Add multi-language support to the admin dashboard using `react-i18next`. Supports **English (en)** and **Indonesian (id)** with browser language detection and manual switching. All hardcoded UI strings are extracted into namespace-based JSON translation files.

## Architecture

- **Library:** `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- **Approach:** Frontend-only. API responses remain locale-agnostic.
- **Namespaces:** One JSON file per feature area, lazy-loaded.
- **Fallback:** English (`en`) is the fallback language.
- **Persistence:** Language choice saved to `localStorage`.

## Components

| Path | Responsibility |
|------|----------------|
| `src/i18n/config.ts` | i18next initialization with language detector, namespace loading, fallback config. |
| `src/i18n/locales/en/*.json` | English translation files (one per namespace). |
| `src/i18n/locales/id/*.json` | Indonesian translation files (one per namespace). |
| `src/components/layout/language-switcher.tsx` | `LanguageSwitcher` — dropdown to switch between en/id, uses `i18n.changeLanguage()`. |

## Namespaces

| Namespace | Scope |
|-----------|-------|
| `common` | Shared: buttons (Save, Cancel, Delete, Edit, Create, Export, Close), loading states, error messages, pagination, table headers, confirmation dialogs, empty states. |
| `sidebar` | Navigation labels: Dashboard, Queue, POS, Transactions, etc. Section headers. |
| `auth` | Login form, logout confirmation. |
| `dashboard` | Dashboard cards, chart labels, date range selectors. |
| `queue` | Queue board, status labels (Waiting, Called, In Service, etc.), actions. |
| `pos` | POS checkout, cart, payment methods, discount, tip, tax labels. |
| `transactions` | Transaction list, filters, status badges, detail modal, void action. |
| `staff` | Barber management table, create/edit forms, status labels. |
| `attendance` | Attendance log, shift schedule, calendar, clock-in/out. |
| `commissions` | Earnings table, filters, commission model labels. |
| `payroll` | Payroll periods, status badges, actions (generate, submit, approve, disburse). |
| `inventory` | Product table, stock actions (stock-in, stock-out, adjust), alerts. |
| `cash-drawer` | Drawer open/close, entries, discrepancy summary. |
| `reviews` | Review table, rating filter, moderation actions. |
| `loyalty` | Loyalty lookup, point adjustment, referral stats, expiry. |
| `campaigns` | Campaign list, create/edit form, status lifecycle, send action. |
| `branches` | Branch settings tabs, operating hours, surge pricing rules. |
| `analytics` | Tab labels, chart titles, comparison, heatmap, retention, utilization. |
| `reports` | Report types, export buttons, date range, empty states. |
| `users` | User table, role change, branch assignment, activate/deactivate. |
| `crm` | Customer insights table, segmentation, recompute. |
| `audit` | Audit log table, anomaly dashboard, severity cards, resolve dialog. |
| `finance` | P&L cards, revenue/cost breakdown, void/discount audit. |
| `config` | Config groups (Loyalty, Referrals, POS & Tax, Commission Templates), field labels. |
| `notifications` | Notification list, stats cards, test-send dialog. |
| `retention` | Retention stats, trigger policy, manual run dialog. |
| `services` | Service catalog, tier surcharges, combos, branch overrides. |
| `barber-portal` | My Schedule, My Commissions, My Attendance headings and labels. |

## Integration Points

- `app/providers.tsx` or `app/main.tsx`: Import `i18n/config.ts` before app render.
- `components/layout/sidebar.tsx`: Replace hardcoded nav labels with `t('sidebar:key')`.
- Every page and widget: Replace string literals with `t('namespace:key')` calls.
- Form validation messages: Use `t()` in Zod schema `message` fields or in error display.
- Date/number formatting: Continue using `toLocaleString()` with the current i18n language code.

## Scenarios

- **GIVEN** user visits admin **WHEN** browser language is `id` **THEN** UI renders in Indonesian.
- **GIVEN** user switches language via dropdown **WHEN** selecting `en` **THEN** all visible strings update to English immediately.
- **GIVEN** a translation key is missing in `id` **WHEN** rendering **THEN** fallback to `en` value.
- **GIVEN** language is switched **WHEN** user refreshes **THEN** the chosen language persists from localStorage.

## RBAC

- No RBAC needed. Language switching is available to all authenticated users.
