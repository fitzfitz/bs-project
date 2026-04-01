# Admin — Platform Config

## Overview

The **config** feature lets HQ staff view and edit **organization-scoped platform configuration** entries (loyalty rates, referral rules, POS/tax limits, default commission template percentages). Data is loaded from the REST API and edited per key with inline save actions.

## Components

| Path | Responsibility |
|------|----------------|
| `widgets/config-panel.tsx` | `ConfigPanel` — groups keys by section (Loyalty, Referrals, POS & Tax, Commission Templates), shows last update metadata, controlled inputs, per-key save. |

## Hooks (`api/`)

| Hook | Endpoint | Behavior |
|------|----------|----------|
| `useConfig` | `GET /config` | TanStack Query `queryKey: ["platform-config"]`. Returns envelope; UI reads `data.data` as `ConfigMap`. |
| `useUpdateConfig` | `PATCH /config/:key` | Mutation with `{ key, value }`. On success invalidates `["platform-config"]`. |

### Types (`api/use-config.ts`)

- `ConfigEntry`: `value`, `updatedBy`, `updatedAt`
- `ConfigMap`: `Record<string, ConfigEntry>`

## Hook consumers

| Consumer | Hooks used |
|----------|------------|
| `pages/config/page.tsx` | Renders `ConfigPanel`. |
| `widgets/config-panel.tsx` | `useConfig`, `useUpdateConfig`. |
| `features/pos/widgets/pos-checkout.tsx` | `useConfig` (e.g. `TAX_RATE`) — cross-feature consumer. |

## Business Rules

1. **`useConfig`** loads the full map under key **`["platform-config"]`**; UI reads `data.data` as `ConfigMap`.
2. **`useUpdateConfig`** PATCHes **`/config/:key`** with `{ value }` and on success invalidates **`["platform-config"]`**.
3. **Per-key save** is skipped in UI when draft equals server value; `savingKey` scopes loading/disabled state to one row.
4. **RBAC:** enforced at route/API; panel does not check permissions internally.

## Hook States

### Query hooks (`useConfig`)

- **Loading:** GIVEN panel mounted WHEN GET `/config` is fetching THEN `isLoading: true`, skeletons shown.
- **Error:** GIVEN API failure WHEN query settles THEN `isError: true`, `error` available for messaging.
- **Disabled:** GIVEN N/A (`enabled` default true) WHEN mounted THEN fetch runs.
- **Success:** GIVEN envelope WHEN settled THEN `data.data` is `ConfigMap` for inputs.

### Mutation hooks (`useUpdateConfig`)

- **Pending:** GIVEN save clicked WHEN PATCH in flight THEN `isPending: true` on the mutation object.
- **Error:** GIVEN PATCH fails WHEN mutation rejects THEN `isError: true`, error text under sections.
- **Success:** GIVEN PATCH succeeds WHEN mutation resolves THEN **`["platform-config"]`** is invalidated and list refetches.

## State

- **Server:** TanStack Query cache for full config map.
- **Local (component):** `editValues` (draft strings per key), `savingKey` (which key is submitting).

## User Interactions

1. **Load:** Skeleton placeholders while `useConfig` is loading.
2. **Edit:** Change text input for a key; value tracks in `editValues`.
3. **Save:** Click save icon — no-op if draft equals server value; otherwise calls `useUpdateConfig` and clears `savingKey` on settle.
4. **Error:** Mutation error message rendered below sections.

## Scenarios

- **GIVEN** config is loaded **WHEN** user changes a key and clicks save **THEN** `PATCH /config/:key` is sent with new value and list refreshes after invalidation.
- **GIVEN** draft matches server value **WHEN** user clicks save **THEN** mutation is not invoked (button disabled).
- **GIVEN** `PATCH` fails **WHEN** mutation settles **THEN** error text is visible.

## Edge Cases

- Missing keys in API response: inputs fall back to empty string; save still allowed.
- `updatedAt` / `updatedBy` optional display: only shown when present.
- Rapid saves on different keys: `savingKey` scopes disabled state to one row.

## RBAC

- Backend must enforce **organization tenant** and a suitable feature (e.g. branch/HQ settings or platform config) with **update** where required. Admin UI does not perform permission checks; routes/pages should be wrapped with `require-permission` for the correct feature code from `docs/rbac_system.md` (typically HQ-scoped settings).

## Dependencies

- `@tanstack/react-query`, `@/lib/api` (Axios envelope unwrap), `lucide-react` icons.
