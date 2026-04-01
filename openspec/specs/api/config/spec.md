# API: Config (organization platform config)

## Overview

Read merged **platform configuration** for the tenant: every key in `CONFIG_DEFAULTS` is returned with effective `value` (DB override or default), optional `updatedBy`, and `updatedAt`. **PATCH** upserts a single `PlatformConfig` row by `key`, clears the in-memory cache entry for that key, and writes an `auditLog` row. All routes require Bearer JWT, `X-Org-Slug` / org scope, and `ORG_SETTINGS` permission.

**Base path:** `/api/config` (see `config.index.ts`).

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/` | `ORG_SETTINGS` **read** | Effective values for all default keys (object keyed by key name). |
| PATCH | `/{key}` | `ORG_SETTINGS` **update** | Upsert one key; body `{ value: string }`. |

---

### GET `/`

**Request**

- **Headers:** `Authorization: Bearer <JWT>`, org scope headers as for other API routes.
- **Query:** none.

**Response `200`**

Envelope:

```json
{
  "success": true,
  "data": {
    "POINTS_EARN_RATE": {
      "value": "string",
      "updatedBy": "string | null",
      "updatedAt": "string"
    }
  }
}
```

- **`data`** is a **record** whose keys are exactly the entries in `CONFIG_DEFAULTS` (11 keys):  
  `POINTS_EARN_RATE`, `POINTS_REDEEM_RATE`, `POINTS_EXPIRY_MONTHS`, `MAX_REDEMPTION_PERCENT`, `REFERRAL_BONUS_POINTS`, `REFERRAL_EXPIRY_DAYS`, `CASHIER_DISCOUNT_LIMIT`, `TAX_RATE`, `COMMISSION_RATE_MASTER`, `COMMISSION_RATE_SENIOR`, `COMMISSION_RATE_JUNIOR`.
- **`value`:** DB `PlatformConfig.value` if a row exists for that key, else the default string from `CONFIG_DEFAULTS`.
- **`updatedBy`:** DB `updatedBy` or `null` if never persisted.
- **`updatedAt`:** ISO datetime string when a row exists; **`""` (empty string)** when only the default applies (no row).

---

### PATCH `/{key}`

**Request**

- **Path params:** `key` — string (Prisma `PlatformConfig.key`, primary key).
- **Body (JSON):** `updateConfigBody`

```json
{
  "value": "string"
}
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "key": "string",
    "value": "string",
    "updatedBy": "string | null",
    "updatedAt": "string"
  }
}
```

- **`data`** is the upserted `PlatformConfig` row (`updatedAt` as ISO string in JSON).

## Business Rules

1. **Default keys:** Only keys defined in `CONFIG_DEFAULTS` appear in **GET** `/` merged output; extra rows in `platform_config` for unknown keys are **not** included in that response.
2. **PATCH upsert:** `PATCH /{key}` creates or updates `PlatformConfig` for `key` with `value` and `updatedBy` = JWT `userId`; there is **no** allow-list in the handler—any string `key` can be upserted.
3. **Cache:** `ConfigService.getValue` caches each key for **5 minutes** (TTL). `updateValue` **deletes** that key from the in-memory cache after a successful upsert.
4. **Audit:** After PATCH, an `auditLog` row is created with `action: "UPDATE"`, `entityType: "PlatformConfig"`, `entityId: key`, `details: { key, newValue: value }`, `userId` from JWT, and tenant `organizationId`.
5. **Read path:** GET uses `getAll`, which loads all `platformConfig` rows and merges with `CONFIG_DEFAULTS` per key (not the per-key cache used by `getValue`).

## Scenarios (GWT)

### `200`

- **GIVEN** valid JWT, org scope, and `ORG_SETTINGS` **read** **WHEN** GET `/` **THEN** `200` with `success: true` and `data` as the full keyed map of defaults/DB merge.
- **GIVEN** valid JWT, org scope, and `ORG_SETTINGS` **update** **WHEN** PATCH `/{key}` with JSON `{ "value": "<any string>" }` **THEN** `200` with `success: true` and `data` equal to the upserted `PlatformConfig` row.

### `400`

- **GIVEN** valid auth and permission **WHEN** PATCH `/{key}` with body missing `value` or wrong JSON shape **THEN** `400` (OpenAPI/Zod validation).
- **GIVEN** valid auth and permission **WHEN** PATCH with invalid `Content-Type` or non-JSON body **THEN** `400` (validation / parse).

### `401`

- **GIVEN** missing or invalid Bearer token **WHEN** GET `/` or PATCH `/{key}` **THEN** `401`.

### `403`

- **GIVEN** valid JWT but missing `ORG_SETTINGS` **read** **WHEN** GET `/` **THEN** `403`.
- **GIVEN** valid JWT but missing `ORG_SETTINGS` **update** **WHEN** PATCH `/{key}` **THEN** `403`.
- **GIVEN** valid token but failing org scope middleware **WHEN** either route **THEN** `403` (or middleware-defined denial).

### `404`

- **N/A** — no route uses a missing-resource lookup; PATCH always upserts for the path `key`.

### `409`

- **N/A** — no unique-constraint conflict surface beyond single-key primary key upsert.

### `201`

- **N/A** — PATCH returns `200`, not `201`.

## Edge Cases

- **Unknown `key` on PATCH:** Still upserts; clients should restrict to documented `CONFIG_DEFAULTS` keys to avoid orphan config keys.
- **`updatedAt` on GET:** Empty string when no DB row exists for that key (only default `value` is shown).
- **DB keys not in `CONFIG_DEFAULTS`:** Omitted from GET `/` merged map until/unless added to `CONFIG_DEFAULTS` in code.
- **OpenAPI vs middleware:** Route definitions may omit every error response; `401`/`403`/`400` come from global middleware and validation.

## RBAC

| Route | Feature | Action |
|-------|---------|--------|
| GET `/` | `ORG_SETTINGS` | **read** |
| PATCH `/{key}` | `ORG_SETTINGS` | **update** |

## Dependencies

- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Prisma:** `platformConfig`, `auditLog`
- **Schema:** `updateConfigBody`, `CONFIG_DEFAULTS` in `config.schema.ts`
- **Service:** `ConfigService.getAll`, `ConfigService.updateValue`, `ConfigService.getValue` (cache TTL used elsewhere, not for `getAll`)
