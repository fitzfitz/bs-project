# API: CRM (`/api/crm`)

## Overview

**Branch-scoped** customer insights derived from **COMPLETED** transactions, optional filters and pagination, **customer segments** (manual + automatic), and **recompute** of automatic segments from in-code rules. Automatic segment names: **VIP**, **REGULAR**, **NEW**, **AT_RISK**, **LAPSED**. All routes: Bearer JWT, org scope, **`CRM` read**.

**Base path:** `/api/crm` (`crm.index.ts`).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/customers` | Paginated customer insights; **required** `branchId` query. |
| GET | `/customers/:id` | Single customer insight; **required** `branchId` query. |
| GET | `/segments` | Segments for a branch; **required** `branchId` query. |
| POST | `/segments/recompute` | Upsert auto segments and repopulate members; body `{ branchId }`. |

---

### GET `/customers`

**Request — query (`listCustomersQuery`)**

| Param | Required | Type / notes |
|--------|----------|----------------|
| `branchId` | yes | string |
| `segment` | no | string — filter by segment **name** after page fetch |
| `minVisits` | no | integer — min completed visit count at branch |
| `sortBy` | no | `"spend"` \| `"visits"` \| `"recency"` (default **`recency`**) |
| `page` | no | integer ≥ 1, default **1** |
| `limit` | no | integer 1–100, default **20** |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "customerId": "string",
      "customerName": "string",
      "email": "string",
      "totalVisits": 0,
      "totalSpend": 0,
      "averageSpend": 0,
      "lastVisitAt": "string | null",
      "daysSinceLastVisit": 0,
      "favoriteServices": ["string"],
      "loyaltyTier": "string",
      "segment": "string | null"
    }
  ],
  "pagination": {
    "page": 0,
    "limit": 0,
    "total": 0,
    "totalPages": 0
  }
}
```

- **`lastVisitAt`:** ISO datetime of last **COMPLETED** transaction at branch, or `null` if none.
- **`daysSinceLastVisit`:** integer days from last visit to “now”, or `null` if no visits.
- **`favoriteServices`:** up to 3 service **names** from line items, by frequency.
- **`loyaltyTier`:** from `customerMembership.tier`, default **`BRONZE`** if none.
- **`segment`:** current segment **name** for this customer on this branch, or `null`.

---

### GET `/customers/:id`

**Request**

- **Path:** `id` — customer user id (`customerId` in transactions).
- **Query:** `branchId` — string, **required**.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "customerId": "string",
    "customerName": "string",
    "email": "string",
    "totalVisits": 0,
    "totalSpend": 0,
    "averageSpend": 0,
    "lastVisitAt": "string | null",
    "daysSinceLastVisit": 0,
    "favoriteServices": ["string"],
    "loyaltyTier": "string",
    "segment": "string | null"
  }
}
```

Same field semantics as list item. **Note:** implementation does **not** return `404` for unknown `id`; see Edge Cases.

---

### GET `/segments`

**Request — query**

| Param | Required | Type |
|--------|----------|------|
| `branchId` | yes | string |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "memberCount": 0,
      "isAutomatic": true
    }
  ]
}
```

---

### POST `/segments/recompute`

**Request — body (`recomputeSegmentsSchema`)**

```json
{
  "branchId": "string"
}
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "segmentsProcessed": 0,
    "totalAssigned": 0
  }
}
```

- **`segmentsProcessed`:** count of automatic segments processed for the branch (after upserting rule rows).
- **`totalAssigned`:** sum of member rows created across segments (customers can be counted in multiple segments).

## Business Rules

1. **Insights source:** Aggregates use **COMPLETED** `transaction` rows for the given `branchId` and non-null `customerId`; spend uses `netAmount`; visits = count of such transactions per customer.
2. **Favorite services:** Counts `transactionItem.name` across those transactions; top 3 names by count.
3. **List sort:** `spend` by `_sum.netAmount`, `visits` by visit count, `recency` by latest `createdAt` (default).
4. **Segment filter (`GET /customers`):** Applied **after** pagination on the **current page’s** insight rows — `total`, `totalPages`, and page content can be **inconsistent** with the true filtered cohort size.
5. **Automatic segments:** Rules live in code (`AUTO_SEGMENTS`). Recompute upserts segments with ids `auto_{branchId}_{NAME}`, clears `customerSegmentMember` per auto segment, then reassigns customers who match rules (visits, spend, last-visit windows, `createdWithinDays` for **NEW**).
6. **Recompute scope:** Uses JWT `organizationId` on created/linked rows; branch must align with tenant usage (same as other org-scoped features).
7. **RBAC:** **Recompute** is guarded by **`CRM` read** only (no separate `update` action on the route).

## Scenarios (GWT)

### `200`

- **GIVEN** valid auth, org scope, `CRM` **read**, and valid query **WHEN** GET `/customers?branchId=…` **THEN** `200` with `data` and `pagination`.
- **GIVEN** same **WHEN** GET `/customers/:id?branchId=…` **THEN** `200` with single `data` insight object.
- **GIVEN** same **WHEN** GET `/segments?branchId=…` **THEN** `200` with `data` array of segments.
- **GIVEN** same **WHEN** POST `/segments/recompute` with `{ "branchId": "…" }` **THEN** `200` with `segmentsProcessed` and `totalAssigned`.

### `400`

- **GIVEN** valid auth and `CRM` **read** **WHEN** GET `/customers` without `branchId` **THEN** `400` (query validation).
- **GIVEN** same **WHEN** GET `/customers/:id` without `branchId` **THEN** `400`.
- **GIVEN** same **WHEN** GET `/segments` without `branchId` **THEN** `400`.
- **GIVEN** same **WHEN** POST `/segments/recompute` with missing `branchId` or invalid JSON **THEN** `400`.

### `401`

- **GIVEN** missing or invalid Bearer **WHEN** any CRM route **THEN** `401`.

### `403`

- **GIVEN** valid JWT but missing `CRM` **read** **WHEN** any CRM route **THEN** `403`.
- **GIVEN** org scope failure **WHEN** any CRM route **THEN** `403` (or middleware-defined denial).

### `404`

- **N/A** — handlers do not perform a “not found” check for unknown `customerId` or unknown `branchId`; list/segments return empty arrays or zero counts, and **GET `/customers/:id`** returns a **zero/empty insight** for unknown customers.

### `409`

- **N/A** — no conflict responses defined for these routes.

### `201`

- **N/A** — all successful responses are `200`.

## Edge Cases

- **Unknown customer on GET `/customers/:id`:** `200` with `totalVisits: 0`, empty name/email, `lastVisitAt` / `daysSinceLastVisit` null, `segment` null — not `404`.
- **Invalid or empty branch:** No explicit branch existence check; queries return empty lists or zeroed aggregates.
- **Segment filter + pagination:** Under-fetches relative to true filtered population (filter after slice).
- **Automatic segment rules (code):** VIP/REGULAR/NEW/AT_RISK/LAPSED thresholds (visits, spend, day windows) are defined in `crm.service.ts` and can change independently of this spec text.

## RBAC

| Route | Feature | Action |
|-------|---------|--------|
| GET `/customers` | `CRM` | **read** |
| GET `/customers/:id` | `CRM` | **read** |
| GET `/segments` | `CRM` | **read** |
| POST `/segments/recompute` | `CRM` | **read** |

## Dependencies

- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission`
- **Prisma:** `transaction`, `transactionItem`, `user`, `customerMembership`, `customerSegment`, `customerSegmentMember`
- **Schema:** `customerInsightsSchema`, `listCustomersQuery`, `segmentSchema`, `recomputeSegmentsSchema` (`crm.schema.ts`)
- **Service:** `CrmService` (`listBranchCustomers`, `getCustomerInsights`, `listSegments`, `recomputeSegments`)
