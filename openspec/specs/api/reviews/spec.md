# API Feature: Reviews (`/api/reviews`)

## Overview

Customer reviews for branches (and optionally staff), with public list/detail, authenticated create, staff moderation (visibility), and hard delete for roles with delete permission. Creating a review requires a completed paid visit at the branch; aggregates on `Branch` and `StaffProfile` are recalculated after writes.

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|----------------|-------------|
| GET | `/` | None | Paginated list; optional filters (`branchId`, `staffProfileId`, `minRating`, `includeHidden`). |
| GET | `/:id` | None | Single review by id with customer/staff names. |
| POST | `/` | Bearer + org scope | Customer creates a review. |
| PATCH | `/:id/moderate` | Bearer + org scope + `REVIEWS` **update** | Set `isVisible`; writes `auditLog` `MODERATE_REVIEW`; refreshes aggregates. |
| DELETE | `/:id` | Bearer + org scope + `REVIEWS` **delete** | Deletes review; refreshes aggregates. |

Mounted under `/api/reviews`.

## Business Rules

- **Eligibility:** `queueEntry` must exist with `customerId`, `branchId`, `status: PAID` (and `id` = `queueEntryId` when provided).
- **Duplicate:** If `queueEntryId` is set, unique `(customerId, queueEntryId)` — second create → **409**.
- **Not visited:** No matching visit → **403** with message containing `only review`.
- **List default:** `includeHidden` defaults `false`; only `isVisible: true` unless overridden.
- **Moderation:** Updates `isVisible` only (note stored in audit details).

## Scenarios

### Success

- **GIVEN** reviews in DB **WHEN** GET `/` **THEN** **200**, `data` + `pagination`.
- **GIVEN** existing id **WHEN** GET `/:id` **THEN** **200** and mapped DTO.
- **GIVEN** paid visit at branch **WHEN** POST `/` **THEN** **201** and review DTO.
- **GIVEN** moderator with permission **WHEN** PATCH `/:id/moderate` **THEN** **200** message.
- **GIVEN** admin with delete permission **WHEN** DELETE `/:id` **THEN** **200**.

### Failure

- **GIVEN** unknown id **WHEN** GET `/:id` **THEN** **404** `"Review not found"`.
- **GIVEN** no paid visit **WHEN** POST `/` **THEN** **403**.
- **GIVEN** duplicate queue visit **WHEN** POST `/` **THEN** **409** `"already reviewed"`.
- **GIVEN** no Bearer **WHEN** POST `/` or moderate/delete **THEN** **401**.
- **GIVEN** missing org on JWT **WHEN** POST `/` **THEN** **403** (org scope).
- **GIVEN** no `REVIEWS` update **WHEN** PATCH moderate **THEN** **403**.
- **GIVEN** no `REVIEWS` delete **WHEN** DELETE **THEN** **403**.

## Edge Cases

- **Public list:** Hidden reviews still queryable if `includeHidden=true` (no auth required) — intentional for admin-style clients that pass the flag.
- **Handler errors:** Other `ReviewService` errors from create return **400** with `err.message`.

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| GET `/`, GET `/:id` | None |
| POST `/` | Authenticated + org scope (no feature code on route) |
| PATCH `/:id/moderate` | `REVIEWS` **update** |
| DELETE `/:id` | `REVIEWS` **delete** |

## Dependencies

- **Prisma:** `review`, `queueEntry`, `user`, `staffProfile`, `branch`, `auditLog`.
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
