# API: Multi-Currency Support

## Overview

Replace all hardcoded IDR currency references with dynamic, org-driven currency. The `Organization` model already has `currency` (default `"IDR"`) and `currencySymbol` (default `"Rp"`) string fields. This change propagates those values through the auth session, payment adapter, report generation, loyalty configuration, and all frontend display layers.

## Changes

### 1. Auth Session — Currency in `/me` and login/register responses

**Goal:** Frontend apps receive the org's `currency` and `currencySymbol` as part of the session so they can format amounts dynamically.

**Backend changes:**
- `AuthService.getUserById()` joins `organization` to fetch `currency`, `currencySymbol`, `locale`.
- `meRoute` response schema adds `organization: { currency, currencySymbol, locale }`.
- Login/register/refresh handlers include the same org currency fields in the user response.

**Response shape addition (inside `data.user` or `data`):**
```json
{
  "organization": {
    "currency": "IDR",
    "currencySymbol": "Rp",
    "locale": "id-ID"
  }
}
```

### 2. Loyalty — Config-Driven Rates

**Goal:** Replace hardcoded `EARN_RATE = 10_000` and `REDEEM_RATE = 500` with org config values.

**Changes in `loyalty.service.ts`:**
- Read `POINTS_EARN_RATE` and `POINTS_REDEEM_RATE` from `ConfigService.getNumericConfig()` instead of constants.
- Keep current values as fallback defaults (already in `CONFIG_DEFAULTS`).

### 3. Xendit Adapter — Currency Parameter

**Goal:** Pass `currency` to Xendit invoice creation so it works for non-IDR orgs.

**Changes in `xendit-adapter.ts`:**
- Add optional `currency?: string` to `createXenditInvoice` params.
- Include `currency` in the Xendit API request body when provided.

**Changes in callers:**
- `payments.handlers.ts`: Pass org currency from context.
- `queue.service.ts` (prepayment): Pass org currency.

### 4. Reports — Currency Formatting

**Goal:** PDF and CSV exports include properly formatted currency values.

**Changes in `reports.service.ts`:**
- Accept `currency` and `locale` parameters in `generateReport()`.
- Add a `formatAmount(value: number, currency: string, locale: string)` utility using `Intl.NumberFormat`.
- Apply formatting to all numeric revenue/amount columns in PDF cell rendering and CSV generation.

### 5. Frontend — Shared Currency Formatter

**Goal:** Single `formatCurrency()` utility in both admin and client apps, driven by org config from session.

**Admin (`apps/admin/src/lib/utils.ts`):**
- Add `formatCurrency(amount: number, currency?: string, locale?: string): string`.
- Default `currency` to `"IDR"` and `locale` to `"id-ID"` (overridden by session org data).

**Client (`apps/client/src/lib/utils.ts`):**
- Same `formatCurrency()` utility.

**Session stores (both apps):**
- Add `organization?: { currency: string; currencySymbol: string; locale: string }` to `UserSession` type.
- Store org data from login/register/me responses.

### 6. Frontend — Replace Hardcoded IDR

Replace all `Intl.NumberFormat('id-ID', { currency: 'IDR' })` and manual `Rp ` prefix patterns with `formatCurrency()` from `@/lib/utils`, using currency from session store.

**Admin files (~15):**
- `features/pos/widgets/pos-checkout.tsx`
- `features/inventory/widgets/product-manager.tsx`
- `features/services/widgets/service-manager.tsx`
- `features/crm/widgets/crm-dashboard.tsx`
- `features/finance/widgets/finance-overview.tsx`
- `features/analytics/widgets/analytics-dashboard.tsx`
- `features/dashboard/widgets/dashboard-overview.tsx`
- `features/commissions/widgets/commission-overview.tsx`
- `features/config/widgets/config-panel.tsx`
- `features/reports/widgets/report-generator.tsx`
- `pages/transactions/page.tsx`
- `pages/cash-drawer/page.tsx`
- `pages/barber-portal/my-commissions.tsx`
- `pages/pos/page.tsx`

**Client files (~5):**
- `features/booking/components/service-selection.tsx`
- `features/booking/components/booking-confirm.tsx`
- `features/loyalty/components/loyalty-card.tsx`
- `pages/history/history-page.tsx`
- `pages/history/receipt-page.tsx`

## Business Rules

1. **Backward compatible:** Default values are IDR/Rp/id-ID — existing orgs see no change.
2. **Org-level setting:** Currency is per-organization, set at org creation. Not per-branch.
3. **Storage unchanged:** Amounts remain `Float` in Prisma. The currency only affects display and external API calls.
4. **Loyalty rates are config-driven:** `POINTS_EARN_RATE` and `POINTS_REDEEM_RATE` from `PlatformConfig` (existing keys, already in `CONFIG_DEFAULTS`).

## Scenarios

### Auth `/me` with currency
- **GIVEN** authenticated user **WHEN** GET `/auth/me` **THEN** response includes `organization.currency`, `organization.currencySymbol`, `organization.locale`.

### Loyalty config-driven rates
- **GIVEN** org config `POINTS_EARN_RATE=5000` **WHEN** customer earns points **THEN** earn rate uses 5000 (not hardcoded 10000).

### Xendit with currency
- **GIVEN** org currency is `"USD"` **WHEN** creating Xendit invoice **THEN** request body includes `"currency": "USD"`.

### Report formatting
- **GIVEN** org currency is `"IDR"` and locale is `"id-ID"` **WHEN** generating PDF report **THEN** revenue columns display formatted currency (e.g., "Rp 150.000").

### Frontend formatting
- **GIVEN** session has `organization.currency = "IDR"` **WHEN** rendering any amount **THEN** uses `formatCurrency()` with org currency, not hardcoded IDR.

## Edge Cases

- **Missing org currency:** Falls back to `"IDR"` / `"Rp"` / `"id-ID"`.
- **Xendit currency omitted:** If `currency` param is undefined, Xendit defaults to account-level currency (IDR for Indonesian accounts).
- **Config cache:** Loyalty rates use `ConfigService` 5-minute cache; changes take effect within 5 minutes.
