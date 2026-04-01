# API Feature: Promotions (`/api/promotions`)

## Overview

Promo codes (CRUD + validation) and a helper endpoint to validate loyalty point redemption against a bill. List/validate endpoints are available to any authenticated org user; mutating routes require `PROMOTIONS` **create** (see `promotions.index.ts`).

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|----------------|-------------|
| GET | `/` | Bearer + org scope | List promo codes (handler does not pass `branchId` into service — lists all in DB scope). |
| POST | `/` | Bearer + org scope + `PROMOTIONS` **create** | Create promo code. |
| PATCH | `/:id` | Bearer + org scope + `PROMOTIONS` **create** | Partial update. |
| DELETE | `/:id` | Bearer + org scope + `PROMOTIONS` **create** | Delete promo code. |
| POST | `/validate` | Bearer + org scope | Validate code for branch + gross amount; `organizationId` injected from auth. |
| POST | `/validate-loyalty` | Bearer + org scope | Check points balance, discount vs net amount, and max **50%** of bill. |

Handlers use `c.get("db")` for Prisma. Responses for mutating/validate routes return **raw JSON bodies** (promo entity or validation DTO), not always the global `{ success, data }` envelope.

## Business Rules

- **Validate promo:** Requires `organizationId` in input (from handler). Inactive, wrong branch, outside date range, usage limit, or below `minGrossAmount` → **400** `HTTPException`. Unknown code → **404**.
- **Percentage promos:** Discount = `%` of gross; capped by `maxDiscount` when set.
- **Fixed promos:** Discount = `value`.
- **Validate loyalty:** Membership must exist; points balance ≥ redeem; discount = `points * 500`; cannot exceed `netAmount` or **50%** of `netAmount`.

## Scenarios

### Success

- **GIVEN** promos exist **WHEN** GET `/` **THEN** **200** array of promos.
- **GIVEN** valid payload **WHEN** POST `/` **THEN** **201** created promo.
- **GIVEN** valid patch **WHEN** PATCH `/:id` **THEN** **200** updated promo.
- **GIVEN** existing id **WHEN** DELETE `/:id` **THEN** **200** deleted record.
- **GIVEN** active valid code **WHEN** POST `/validate` **THEN** **200** `{ promoCode, discountAmount, type, value }`.
- **GIVEN** sufficient points within cap **WHEN** POST `/validate-loyalty` **THEN** **200** `{ pointsToRedeem, discountAmount }`.

### Failure

- **GIVEN** no Bearer **WHEN** any route **THEN** **401**.
- **GIVEN** no org on token **WHEN** any route **THEN** **403** (org scope).
- **GIVEN** no `PROMOTIONS` create **WHEN** POST/PATCH/DELETE **THEN** **403**.
- **GIVEN** unknown id **WHEN** PATCH/DELETE **THEN** **404** `HTTPException`.
- **GIVEN** invalid/inactive promo **WHEN** POST `/validate` **THEN** **400** or **404** per rule.

## Edge Cases

- **RBAC naming:** Updates/deletes require **create** permission, not `update`/`delete`.
- **List vs service:** `PromotionsService.listPromoCodes(db, branchId?)` supports branch filter; HTTP handler never passes `branchId`.
- **Response shape:** List/create/update/delete/validate responses omit standard `success` envelope used elsewhere.

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| GET `/`, POST `/validate`, POST `/validate-loyalty` | Authenticated + org scope |
| POST `/`, PATCH `/:id`, DELETE `/:id` | `PROMOTIONS` **create** |

## Dependencies

- **Prisma:** `promoCode`, `customerMembership`.
- **Libraries:** `hono/http-exception` for validation errors.
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
