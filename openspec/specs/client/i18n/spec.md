# Client — Internationalization (i18n)

## Overview

Add multi-language support to the customer PWA using `react-i18next`. Supports **English (en)** and **Indonesian (id)** with browser language detection and manual switching from profile settings. All hardcoded UI strings are extracted into namespace-based JSON translation files.

## Architecture

- **Library:** `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- **Approach:** Frontend-only. API responses remain locale-agnostic.
- **Namespaces:** One JSON file per feature area.
- **Fallback:** English (`en`) is the fallback language.
- **Persistence:** Language choice saved to `localStorage`.

## Components

| Path | Responsibility |
|------|----------------|
| `src/i18n/config.ts` | i18next initialization with language detector, namespace loading, fallback config. |
| `src/i18n/locales/en/*.json` | English translation files (one per namespace). |
| `src/i18n/locales/id/*.json` | Indonesian translation files (one per namespace). |
| `src/components/layout/language-switcher.tsx` | `LanguageSwitcher` — compact toggle for en/id, used on profile page. |

## Namespaces

| Namespace | Scope |
|-----------|-------|
| `common` | Shared: buttons (Submit, Cancel, Back, Continue, Save), loading, errors, empty states. |
| `nav` | Bottom navigation labels: Home, Book, History, Profile. |
| `auth` | Login, Register, Forgot Password forms and messages. |
| `home` | Greeting, loyalty summary, upcoming appointment, branch list heading. |
| `booking` | Booking wizard steps: service selection, barber selection, time selection, confirm. Step labels, totals, payment notice. |
| `branches` | Branch discovery, list/map toggle, search, favorites, branch detail. |
| `loyalty` | Loyalty dashboard, tier progress, points history, referral sharing. |
| `reviews` | Review feed, post review form, star rating, review cards. |
| `profile` | Profile page, edit profile form, notification settings, legal links, account deletion. |
| `notifications` | Notification inbox, mark read, empty state. |
| `payments` | Saved payment methods, add card, delete confirmation. |
| `history` | Booking history, upcoming/past tabs, cancel/reschedule actions, receipt link. |
| `legal` | Terms of Service, Privacy Policy page content. |

## Integration Points

- `app/main.tsx`: Import `i18n/config.ts` before app render.
- `components/layout/BottomNav.tsx`: Replace hardcoded labels with `t('nav:key')`.
- Every page and feature component: Replace string literals with `t('namespace:key')` calls.
- Profile page: Add language switcher component.

## Scenarios

- **GIVEN** user visits client app **WHEN** browser language is `id` **THEN** UI renders in Indonesian.
- **GIVEN** user switches language on profile page **WHEN** selecting `en` **THEN** all visible strings update immediately.
- **GIVEN** a translation key is missing in `id` **WHEN** rendering **THEN** fallback to `en` value.
- **GIVEN** language is switched **WHEN** user refreshes **THEN** chosen language persists.

## RBAC

- No RBAC needed. Language switching is available to all users including unauthenticated.
