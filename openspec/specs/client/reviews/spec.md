# Client — Reviews

## Overview

Customers **browse reviews** (by branch and/or staff), **submit reviews** (rating, comment, optional photos), and **upload images** for review attachments. Uses **TanStack Query**, **react-hook-form** + **Zod**, and **Axios** (`@/lib/api`). Photo uploads use `multipart/form-data` to `/media/upload?prefix=reviews`.

## Business Rules

1. **Review list:** `useReviews` builds `GET /reviews` query string from optional `branchId`, `staffProfileId`, `minRating`, and required `page` / `limit`; default `enabled` is `true` unless the caller passes `enabled: false`.
2. **Pagination UX:** `useReviews` uses `placeholderData: keepPreviousData` so page changes keep prior data visible while fetching.
3. **Create review:** `useCreateReview` posts `POST /reviews` and on success invalidates all queries whose key starts with `["reviews"]`.
4. **Upload:** `useUploadPhoto` sends `FormData` with field `file` to `POST /media/upload?prefix=reviews` and sets `Content-Type: multipart/form-data`.
5. **Feed gating:** When neither branch nor staff scope is needed, callers must still set `enabled: false` if they intend to suppress the request (e.g. missing both ids).

## Components / Widgets

| Piece | Purpose |
|-------|---------|
| `ReviewFeed` | Paginated `useReviews`; optional `ReviewSummary`; loading spinner; empty state; “Load more” when `pagination` allows. |
| `PostReviewDialog` | Modal/sheet hosting `ReviewForm`; `useCreateReview`; success thank-you state; error line. |
| `ReviewForm` | Star rating, comment, up to 3 photos via `useUploadPhoto` + `FormData`; submits aggregated payload. |
| `ReviewCard` | Single review layout: name, date, stars, staff, comment, photo strip. |
| `ReviewSummary` | Average + distribution bars from current page reviews or overridden totals from props. |
| `StarRatingInput` | Interactive or readonly 1–5 stars with hover feedback. |

## Hooks (`api/`)

| Hook | Purpose |
|------|---------|
| `useReviews` | `GET /reviews` with `branchId`, `staffProfileId`, `minRating`, `page`, `limit`; `enabled` flag; `keepPreviousData`. |
| `useCreateReview` | `POST /reviews`; invalidates `['reviews']` on success. |
| `useUploadPhoto` | `POST /media/upload?prefix=reviews` with `FormData`; custom `Content-Type` header. |

## Hook States

### `useReviews`

- **Loading**  
  - **GIVEN** `enabled` is true  
  - **WHEN** the reviews request is in flight (including page changes)  
  - **THEN** `isFetching` / `isPending` reflect loading; `keepPreviousData` may keep prior page visible.

- **Error**  
  - **GIVEN** `GET /reviews` fails  
  - **WHEN** the query errors  
  - **THEN** `isError` / `error` are set for feed error UI.

- **Disabled**  
  - **GIVEN** `enabled: false` (e.g. `ReviewFeed` when neither branch nor staff is provided)  
  - **WHEN** the hook runs  
  - **THEN** no `GET /reviews` is sent.

- **Success**  
  - **GIVEN** success and `enabled` true  
  - **WHEN** settled  
  - **THEN** response is the API envelope; list UI reads `data` and pagination from the response as implemented in consumers.

### `useCreateReview`

- **Loading**  
  - **GIVEN** `mutate` called with `CreateReviewInput`  
  - **WHEN** `isPending` is true  
  - **THEN** `POST /reviews` is in flight.

- **Error**  
  - **GIVEN** create fails  
  - **WHEN** mutation errors  
  - **THEN** mutation `error` is set; `["reviews"]` queries are not invalidated.

- **Disabled**  
  - **GIVEN** form validation fails before `mutate`  
  - **WHEN** submit is blocked  
  - **THEN** no POST.

- **Success**  
  - **GIVEN** post succeeds  
  - **WHEN** `onSuccess` runs  
  - **THEN** `queryClient.invalidateQueries({ queryKey: ["reviews"] })` runs.

### `useUploadPhoto`

- **Loading**  
  - **GIVEN** `mutate(file)` called  
  - **WHEN** `isPending` is true  
  - **THEN** multipart upload to `/media/upload?prefix=reviews` is in flight.

- **Error**  
  - **GIVEN** upload fails  
  - **WHEN** mutation errors  
  - **THEN** mutation `error` is set; form should not append URL.

- **Disabled**  
  - **GIVEN** `ReviewForm` sets `uploading` / disables controls  
  - **WHEN** no file passed to `mutate`  
  - **THEN** no upload.

- **Success**  
  - **GIVEN** upload succeeds  
  - **WHEN** mutation settles  
  - **THEN** response envelope contains `url` (and `key`) for attaching to the review payload.

## Types (`types/index.ts`)

- **`Review`**, **`CreateReviewInput`**, **`ReviewSummary`** (type; summary UI is component `ReviewSummary`).

## State

- `ReviewFeed`: local `page` for pagination.
- `PostReviewDialog`: `submitted` flag.
- `ReviewForm`: `photoUrls`, `uploading`, file input ref.
- `StarRatingInput`: `hovered` star for display.

## User Interactions

- Scroll/load more reviews; filter implicitly via props (`branchId` / `staffProfileId`).
- Open post dialog → set rating → optional text → optional photos → submit.
- Star input: click to set rating; hover preview until leave.

## Scenarios

### Review list

- **GIVEN** `branchId` or `staffProfileId` and successful API  
- **WHEN** `ReviewFeed` loads  
- **THEN** reviews render and summary may show when `showSummary` and count > 0.

### Review list disabled

- **GIVEN** neither `branchId` nor `staffProfileId`  
- **WHEN** `ReviewFeed` calls `useReviews` with `enabled: false`  
- **THEN** the reviews query does not run.

### Empty feed

- **GIVEN** first page returns zero reviews  
- **WHEN** feed renders  
- **THEN** empty state copy is shown.

### Create review

- **GIVEN** valid form data  
- **WHEN** user submits  
- **THEN** `POST /reviews` runs and queries invalidate.

### Photo upload

- **GIVEN** selected image files  
- **WHEN** upload completes  
- **THEN** returned URLs are appended to `photoUrls` (max 3).

## Edge Cases

- **Rating validation:** Submit blocked until rating ≥ 1 (Zod).
- **Upload failures:** `ReviewForm` catches batch upload errors; button disabled while `uploading`.
- **Load more:** `isFetching` disables button to prevent double fetch.
- **Summary totals:** Props `averageRating` / `totalReviews` override computed values from the current page slice.

## Dependencies

- `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`, `axios` (`@/lib/api`), `lucide-react`, UI form primitives.

## Public exports (`index.ts`)

- Hooks and types for pages and booking barber step (`ReviewFeed` import path may be direct from widgets).
