# API Feature: Services (`/api/services`)

## Overview

Organization-scoped **service catalog**: paginated list and detail (public browse), create/update/deactivate, tier surcharges, combo child links, and per-branch price overrides. Mutations require `SERVICE_CATALOG` permissions.

## API Endpoints

| Method | Path | Auth / RBAC | Description |
|--------|------|-------------|-------------|
| GET | `/` | Public | Paginated list; filters `category`, `type`, `isActive` (string→bool), `page`, `limit` (coerced, max 100). |
| GET | `/{id}` | Public | Service with `tierSurcharges`, `comboChildren`, `branchOverrides`. |
| POST | `/` | Bearer + `SERVICE_CATALOG` **create** | Create service for current org. |
| PATCH | `/{id}` | Bearer + `SERVICE_CATALOG` **update** | Partial update. |
| DELETE | `/{id}` | Bearer + `SERVICE_CATALOG` **delete** | Deactivate (`isActive: false`). |
| POST | `/{id}/tier-surcharge` | Bearer + `SERVICE_CATALOG` **update** | Upsert tier surcharge by service+tier. |
| POST | `/{id}/combo` | Bearer + `SERVICE_CATALOG` **update** | Add combo child (no-op if link exists). |
| POST | `/{id}/branch-override` | Bearer + `SERVICE_CATALOG` **update** | Upsert `branchServiceOverride` (price + active flag). |

## Business Rules

- **Create:** Sets `organizationId` from context; `isActive: true`; defaults for `type`, `bufferMinutes`, flags, `sortOrder` per schema.
- **Tier surcharge:** If row exists for `(serviceId, tier)`, **update** surcharge; else **create**.
- **Combo child:** If link exists, returns existing row; else creates `comboService`.
- **Branch override:** Upsert on `(serviceId, branchId)`.
- **Delete:** Soft-delete via `isActive: false` (not a physical delete).

## Scenarios

### Success

- **GIVEN** no auth **WHEN** GET `/` **THEN** **200**, `data` + `pagination`.
- **GIVEN** valid service id **WHEN** GET `/{id}` **THEN** **200**.
- **GIVEN** unknown id **WHEN** GET `/{id}` **THEN** **404** “Service not found”.
- **GIVEN** permission + valid body **WHEN** POST `/` **THEN** **201**.

### Failure

- **GIVEN** no Bearer **WHEN** POST `/` **THEN** **401**.
- **GIVEN** Bearer without `SERVICE_CATALOG` create **WHEN** POST `/` **THEN** **403**.
- **GIVEN** invalid body (e.g. negative price) **WHEN** POST `/` **THEN** validation **400** (OpenAPI/Zod).

## Edge Cases

- **List query coercion:** `page`/`limit` use `z.coerce.number()`; invalid strings may fail validation.
- **Prisma** on PATCH unknown id: may throw **500** (no explicit **404** in handler).

## RBAC

Feature: **`SERVICE_CATALOG`**. Public: GET list, GET by id. Mutations: **create**, **update**, **delete** as wired in `services.index.ts`.

## Dependencies

- **Prisma:** `service`, `tierSurcharge`, `comboService`, `branchServiceOverride`.
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`.
