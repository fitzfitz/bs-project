# Admin — Reviews

## Overview

The **reviews** module provides hooks to **list reviews** for moderation (including hidden) with filters and pagination, **moderate** visibility, and **delete** reviews. UI is **page-local**: **`apps/admin/src/pages/reviews/page.tsx`** composes a **review list** with **`ReviewCard`** (inline) for hide/show and HQ-only delete — there is no `features/reviews/widgets/` directory.

## Business rules

1. **BR-1 (Scoped list):** `useReviews` MUST NOT fetch until `params.branchId` is set (`enabled: !!params.branchId`).
2. **BR-2 (Admin listing):** Query string MUST always send `includeHidden=true` so moderators see hidden reviews regardless of caller passing `includeHidden`.
3. **BR-3 (Pagination defaults):** `page` defaults to `1`, `limit` defaults to `20` in the hook’s URL builder.
4. **BR-4 (Mutations):** Successful moderate or delete MUST invalidate `["admin-reviews"]`.
5. **BR-5 (Moderation body):** `PATCH /reviews/:id/moderate` sends `isVisible` and optional `moderationNote`.

## Hook consumers

| Consumer | Hooks | Role |
|----------|-------|------|
| `apps/admin/src/pages/reviews/page.tsx` | `useReviews`, `useModerateReview`, `useDeleteReview` | Branch selector, rating filters, loading skeletons, error banner, pagination, `ReviewCard` per row with hide/show (`moderate.isPending` disables) and delete for HQ (`remove.isPending`). |

## Hooks (`api/use-reviews.ts`)

| Hook | Method / path | Query key | `enabled` |
|------|---------------|-----------|-----------|
| `useReviews(params)` | `GET /reviews?...` | `["admin-reviews", params]` | `!!params.branchId` |
| `useModerateReview` | `PATCH /reviews/:id/moderate` | — | mutation |
| `useDeleteReview` | `DELETE /reviews/:id` | — | mutation |

## Request / response shapes

**`useReviews` query params (hook input):** `branchId?`, `staffProfileId?`, `minRating?`, `page?`, `limit?`, `includeHidden?` (ignored for wire — always forced `true` in URL).

**Serialized query (always includes):** `includeHidden=true`, `page`, `limit`, plus optional filters.

**`useReviews` response:** `ApiResponse<ReviewListResponse>`.

**`ReviewListResponse`:** `items: ReviewItem[]`, `total`, `page`, `limit`, `totalPages`.

**`ReviewItem`:** `id`, `rating`, `comment`, `photoUrls[]`, `isVisible`, `createdAt`, `queueEntryId`, `branchId`, `staffProfileId`, optional `customer`, optional `staff` (nested user names).

**`useModerateReview` body:** `{ id, isVisible, moderationNote? }` → `PATCH` with `{ isVisible, moderationNote }` → `ApiResponse<ReviewItem>`.

**`useDeleteReview`:** `id: string` → `ApiResponse<unknown>`.

## Hook states

### `useReviews`

- **Loading:** GIVEN `branchId` set WHEN fetch in progress THEN `isLoading` / `isFetching` true; page shows three pulse skeleton placeholders.
- **Error:** GIVEN API error WHEN settled THEN `isError: true`, `error` set; page shows red banner: “Failed to load reviews:” + message.
- **Disabled:** GIVEN `branchId` is undefined/null from store **WHEN** hook initializes THEN `enabled: false`, no list request.
- **Success:** GIVEN success THEN `data.data` matches `ReviewListResponse` (`items`, `total`, `page`, `limit`, `totalPages`).

### `useModerateReview` / `useDeleteReview`

- **Pending:** GIVEN mutate invoked WHEN in flight THEN `isPending: true`; `ReviewCard` disables hide/show or delete button.
- **Error:** GIVEN API failure THEN `isError: true`, `error` set (surface per-card or toast — not all wired today).
- **Success:** GIVEN success THEN `["admin-reviews"]` invalidates and list refetches.

## UI / widget GWT (reviews page)

- **GIVEN** no branch selected **WHEN** page loads **THEN** `useReviews` disabled — list area should show empty or prompt (align UI with disabled state).
- **GIVEN** branch selected **WHEN** list loading **THEN** skeleton placeholders visible, not cards.
- **GIVEN** list error **WHEN** `error` present **THEN** error banner above content with `(error as Error).message`.
- **GIVEN** visible review **WHEN** moderator clicks Hide **THEN** `moderate.mutate` with toggled `isVisible` and note; button disabled while `moderate.isPending`.
- **GIVEN** HQ scope **WHEN** user confirms delete **THEN** `remove.mutate(review.id)` with delete button disabled while `remove.isPending`.
- **GIVEN** rating filter change **THEN** reset `page` to 1 (page behavior) and refetch with new params.

## Scenarios

- **GIVEN** no `branchId` **WHEN** hook runs **THEN** query disabled.
- **GIVEN** `branchId` set **WHEN** fetch completes **THEN** `data.data` matches list envelope.
- **GIVEN** moderate succeeds **WHEN** mutation completes **THEN** reviews query invalidates.

## Edge cases

- `includeHidden` forced true — admin-only listing behavior; public client would use different hook.
- Pagination defaults: `page` 1, `limit` 20.

## RBAC

- **`REVIEWS`** update/delete for moderation; list requires **read**. API enforces org + branch scope. UI additionally gates delete on `tenantRoleScope === "HQ"` in `ReviewCard`.

## Dependencies

- `@tanstack/react-query`, `@/lib/api`.
