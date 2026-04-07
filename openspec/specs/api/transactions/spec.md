# Transactions API

## Overview

Creates draft (**PENDING**) sales transactions, records payments to complete them (**COMPLETED**), voids completed transactions, lists and summarizes transactions, and returns receipt-shaped data. Completing a transaction runs side effects (queue PAID, promo usage, loyalty, referrals, commissions, inventory stock-out) inside a DB transaction.

**Base path:** `/api/transactions`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Bearer + org + `TRANSACTION` create | Create `PENDING` transaction; idempotent when `clientUuid` already exists (returns existing). |
| POST | `/{id}/pay` | Bearer + org + `TRANSACTION` create | Add payments; total must match `totalDue` within 0.01; sets **COMPLETED** and runs side effects (including receipt email if not opted out). |
| POST | `/{id}/void` | Bearer + org + `TRANSACTION` delete | Void transaction; inventory reversal for product lines; audit log. |
| POST | `/{id}/refund` | Bearer + org + `TRANSACTION` delete | Refund completed transaction; reverses inventory stock and loyalty points; audit log. |
| GET | `/` | Bearer + org + `TRANSACTION` read | Paginated list; query: `branchId` (required), filters, `page`, `limit`. |
| GET | `/summary` | Bearer + org + `TRANSACTION` read | Daily summary for `branchId` and optional `date`. |
| GET | `/{id}` | Bearer + org | Full transaction details. **Access**: Requires `TRANSACTION` read permission OR ownership (`customerId` matches current user). |
| GET | `/{id}/receipt` | Bearer + org | Receipt DTO. **Access**: Requires `TRANSACTION` read permission OR ownership (`customerId` matches current user). |

## Request / response shapes

### POST `/` — create

**Request** (`application/json`):

```json
{
  "branchId": "string",
  "queueEntryId": "string (optional)",
  "staffProfileId": "string (optional)",
  "customerId": "string (optional)",
  "items": [
    {
      "serviceId": "string (optional)",
      "productId": "string (optional)",
      "name": "string",
      "quantity": 1,
      "unitPrice": 0,
      "discount": 0,
      "isAddOn": false
    }
  ],
  "tipAmount": 0,
  "discountAmount": 0,
  "promoCode": "string (optional)",
  "loyaltyPointsUsed": 0,
  "clientUuid": "uuid (optional, offline dedup)"
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": "string",
    "organizationId": "string",
    "branchId": "string",
    "status": "PENDING",
    "grossAmount": 0,
    "discountAmount": 0,
    "taxAmount": 0,
    "tipAmount": 0,
    "netAmount": 0,
    "totalDue": 0,
    "clientUuid": "string | null",
    "items": [
      {
        "id": "string",
        "name": "string",
        "quantity": 1,
        "unitPrice": 0,
        "discount": 0,
        "total": 0,
        "serviceId": "string | null",
        "productId": "string | null",
        "isAddOn": false
      }
    ]
  }
}
```

### POST `/{id}/pay`

**Request** (`application/json`):

```json
{
  "payments": [
    {
      "method": "CASH | CARD | QRIS | DIGITAL_WALLET",
      "amount": 0,
      "reference": "string (optional)"
    }
  ]
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "message": "Payments recorded",
  "data": {
    "id": "string",
    "status": "COMPLETED",
    "items": [],
    "payments": [
      {
        "id": "string",
        "method": "string",
        "amount": 0,
        "reference": "string | null"
      }
    ]
  }
}
```

### POST `/{id}/void`

**Request** (`application/json`):

```json
{
  "reason": "string (min 5 characters)"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "message": "Transaction voided",
  "data": {
    "id": "string",
    "status": "VOIDED"
  }
}
```

### POST `/{id}/refund`

**Request** (`application/json`):

```json
{
  "reason": "string (min 5 characters)"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "message": "Transaction refunded",
  "data": {
    "id": "string",
    "status": "REFUNDED"
  }
}
```

### GET `/` — list

**Query:** `branchId` (required), optional `queueEntryId`, `dateFrom`, `dateTo`, `status`, `staffProfileId`, `page`, `limit`.

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "customerId": "ID of the authenticated user who owns the transaction (can be null for pure Guest walk-ins).",
      "receiptNumber": "A persistent, human-readable identifier (e.g. TX-20260406-001) generated exactly once when the transaction is COMPLETED.",
      "status": "PENDING | COMPLETED | VOIDED | REFUNDED",
      "branchId": "string",
      "items": [],
      "payments": [],
      "queueEntry": {}
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### GET `/summary`

**Query:** `branchId` (required), `date` (optional ISO date string; defaults to today on server).

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "count": 0,
    "totalRevenue": 0,
    "totalServiceRevenue": 0,
    "totalProductRevenue": 0,
    "totalTips": 0,
    "paymentMethods": {
      "CASH": 0,
      "CARD": 0,
      "QRIS": 0,
      "DIGITAL_WALLET": 0
    }
  }
}
```

### GET `/{id}/receipt`

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "receiptNumber": "string",
    "date": "string",
    "branchId": "string",
    "branchName": "string",
    "branchAddress": "string",
    "cashierName": "string",
    "staffProfileId": "string | null",
    "staffName": "string | null",
    "queueEntryId": "string | null",
    "items": [
      { "name": "string", "qty": 0, "unitPrice": 0, "discount": 0, "total": 0 }
    ],
    "subtotal": 0,
    "discountTotal": 0,
    "tax": 0,
    "tip": 0,
    "grandTotal": 0,
    "payments": [{ "method": "string", "amount": 0 }],
    "loyaltyPointsEarned": 0
  }
}
```

## Business Rules

1. **Amounts:** `grossAmount` from line items; promo and loyalty discounts via `promotionsService`; optional manual `discountAmount` combined with tax from org settings (`taxEnabled` / `taxRate`).
2. **Manual discount RBAC (service):** If `discountAmount > 0` and `scope === "CASHIER"`, manual discount as % of gross cannot exceed **10%** — throws `HTTPException` **403** (handler currently maps many errors to **500** except Prisma duplicate).
3. **Payments:** Sum of `payments[].amount` must equal `totalDue` (epsilon 0.01); transaction must be **PENDING**.
4. **Void:** Not allowed if already **VOIDED**; restores stock for product items via `InventoryService.recordVoidReversal`.
5. **Refund:** Only allowed on **COMPLETED** transactions; reverses inventory stock (same as void), reverses loyalty points earned (deducts from customer), restores loyalty points used (returns to customer); creates `REFUND_TRANSACTION` audit log with reason and amounts.
5. **Duplicate offline id:** If the same `clientUuid` was already persisted, `POST /` returns the existing transaction (**201**, idempotent). If two creates race and hit the unique constraint, handler returns **409** with message **`Duplicate client UIID`** (typo in implementation; intent: duplicate client UUID).
6. **Audit:** `APPLY_DISCOUNT` audit when total discounts applied on create.

## Scenarios

### Success

- **GIVEN** valid items and org tax settings **WHEN** `POST /` **THEN** `201` with `PENDING` transaction and line items.
- **GIVEN** existing `clientUuid` **WHEN** `POST /` with same UUID **THEN** returns existing row (idempotent **`201`**).
- **GIVEN** `PENDING` tx and payments totaling `totalDue` **WHEN** `POST /{id}/pay` **THEN** `200` and `COMPLETED`.
- **GIVEN** `COMPLETED` tx **WHEN** `POST /{id}/void` with reason ≥ 5 chars **THEN** `200` and `VOIDED`.
- **GIVEN** `COMPLETED` tx **WHEN** `POST /{id}/refund` with reason ≥ 5 chars **THEN** `200` and `REFUNDED`; inventory stock reversed; loyalty earned deducted; loyalty redeemed restored.
- **GIVEN** filters **WHEN** `GET /` **THEN** `200` with `data` + `pagination`.

### Failure

- **GIVEN** no/invalid JWT **WHEN** any protected route **THEN** `401`.
- **GIVEN** role without `TRANSACTION` read/create/delete **WHEN** matching route **THEN** `403`.
- **GIVEN** wrong id **WHEN** `GET /{id}` or pay/void **THEN** `404` (message contains `not found`).
- **GIVEN** `COMPLETED` tx **WHEN** `POST /{id}/pay` **THEN** `400` (already completed).
- **GIVEN** payment totals ≠ `totalDue` **WHEN** pay **THEN** `400` mismatch.
- **GIVEN** voided tx **WHEN** void again **THEN** `400` already voided.
- **GIVEN** refunded tx **WHEN** refund again **THEN** `400` already refunded.
- **GIVEN** `PENDING` tx **WHEN** refund **THEN** `400` only completed can be refunded.
- **GIVEN** refund reason < 5 chars **WHEN** `POST /{id}/refund` **THEN** validation error.
- **GIVEN** duplicate `clientUuid` under race (unique constraint) **WHEN** `POST /` **THEN** `409` with message `Duplicate client UIID` (spec: duplicate client UUID).

### HTTP status coverage (`POST /`)

| Code | Applies |
|------|---------|
| **200** | N/A — create returns **201**. |
| **201** | New transaction or idempotent return of existing by `clientUuid`. |
| **400** | N/A from handler for create (validation via OpenAPI/Zod upstream). |
| **401** | Missing/invalid JWT. |
| **403** | Missing `TRANSACTION` create permission. |
| **404** | N/A — create does not address resource by id. |
| **409** | Prisma **P2002** on `clientUuid` (concurrent duplicate insert). |
| **500** | Uncaught service/handler errors (e.g. manual discount **403** not mapped). |

### HTTP status coverage (`POST /{id}/pay`)

| Code | Applies |
|------|---------|
| **200** | Payments recorded; transaction **COMPLETED**. |
| **400** | Payment mismatch; transaction not **PENDING**. |
| **401** | Missing/invalid JWT. |
| **403** | Missing `TRANSACTION` create. |
| **404** | Transaction id not found. |
| **409** | N/A — no idempotent conflict rule on pay. |
| **500** | Uncaught handler errors. |

### HTTP status coverage (`POST /{id}/refund`)

| Code | Applies |
|------|---------|
| **200** | Transaction refunded; inventory and loyalty reversed. |
| **400** | Transaction not COMPLETED; already REFUNDED; reason too short. |
| **401** | Missing/invalid JWT. |
| **403** | Missing `TRANSACTION` delete. |
| **404** | Transaction id not found. |
| **409** | N/A |
| **500** | Uncaught handler errors. |

### HTTP status coverage (`GET /{id}/receipt`)

| Code | Applies |
|------|---------|
| **200** | Receipt DTO. |
| **400** | N/A |
| **401** | Missing/invalid JWT. |
| **403** | Forbidden: Not the owner and lacks `TRANSACTION` read permission. |
| **404** | Transaction not found. |
| **409** | N/A |

## Edge Cases

- `listTransactions`: `dateFrom` alone expands to that calendar day `[gte, lt+1day)`; `dateFrom`+`dateTo` use raw range.
- Side effects in `finalizeTransactionSideEffects` log errors but do not fail payment commit.
- `finalizeTransactionOnPaid` used by payment webhooks (not mounted on this router).

## Service-Level Test Scenarios (Sprint 7)

### TransactionService.createTransaction

- Tax calculation with `taxEnabled: true` and `taxRate: 11` on gross minus discounts.
- Manual discount allowed for non-CASHIER scope (no 10% cap).
- Manual discount > 10% of gross rejected with `HTTPException(403)` for CASHIER scope.
- Promo code integration: `discountAmount` includes promo discount.
- Loyalty redemption: `loyaltyPointsUsed` validated when `customerId` present; skipped when absent.
- `clientUuid` idempotent return of existing transaction.
- `APPLY_DISCOUNT` audit log created when `discountAmount > 0`.

### TransactionService.addPayments

- Success: `PENDING` tx + matching payment total → `COMPLETED` with items and payments.
- Not found: throws "Transaction not found".
- Already completed: throws "Transaction is already COMPLETED".
- Payment mismatch beyond 0.01 tolerance.
- Side effects (`finalizeTransactionSideEffects`) triggered after completion.

### TransactionService.voidTransaction

- Success: non-VOIDED tx → `VOIDED`; inventory `recordVoidReversal` called per product line.
- Already voided: rejected.
- Not found: throws.
- `VOID_TRANSACTION` audit log with reason.

### TransactionService.refundTransaction

- Success: `COMPLETED` → `REFUNDED`; inventory reversed; loyalty earned deducted; loyalty redeemed restored.
- Not COMPLETED: rejected.
- Already refunded: rejected.
- Not found: throws.
- Loyalty reversal failure is swallowed (logged, not rethrown).
- `REFUND_TRANSACTION` audit log with reason and `refundedAmount`.

### TransactionService.getDailySummary

- Empty day returns zeros.
- Mixed service and product items split revenue correctly.
- Tips aggregated; payment methods bucketed.

### TransactionService.listTransactions

- `dateFrom` alone expands to single calendar day.
- `dateFrom` + `dateTo` uses raw range.
- Status and staff filters applied.
- Pagination: page, limit, totalPages.

### TransactionService.getReceiptData

- Sequential receipt number `TX-YYYYMMDD-###`.
- Staff name from queue entry; `cashierName: "—"`.
- Not found: throws.

### finalizeTransactionSideEffects

- Queue entry set to PAID (best-effort).
- Promo usage count incremented (best-effort).
- Loyalty points earned and recorded (best-effort).
- Referral reward on first COMPLETED (best-effort).
- Commission triggered via `CommissionService.triggerOnPaid` (best-effort).
- Inventory stock-out per product line (best-effort).
- 407. **Receipt Email**: Sent via `NotificationService.sendEmail` IF the customer has not opted out (via `emailOptOut: true` in `NotificationPreference`). 
    - **Legacy Fallback**: If no `NotificationPreference` record exists, the system defaults to **Opted-In** (email sent).
    - **New Users**: Default to **Opted-Out** (record created with `emailOptOut: true` at registration).
- 408. Individual failures logged but do not fail the overall commit.

## RBAC

1. **Write operations** (POST `/`, pay, void, refund): Require explicit `TRANSACTION` permissions (`create` or `delete`).
2. **Global read** (GET `/`, GET `/summary`): Requires explicit `TRANSACTION` read permission.
3. **Detail/Receipt read** (GET `/{id}`, GET `/{id}/receipt`): Requires **EITHER** `TRANSACTION` read permission **OR** ownership. 
   - **Ownership** is verified against `transaction.customerId` matching the current user's `userId`.
   - **Fallback**: If `transaction.customerId` is null (e.g. Guest checkout), authorization is granted if the linked `transaction.queueEntry.customerId` matches the current user's `userId`.
4. **Identity Handover**: During any checkout or payment finalization (e.g., via `createCharge` or `webhook`), the system MUST attempt to link the authenticated payer's `userId` to the `transaction.customerId` if it is currently unlinked.

## Dependencies

- **promotions:** `validatePromoCode`, `validateLoyaltyRedemption`
- **loyalty, referrals, commissions, inventory:** dynamic imports on completion/void/refund
- **Prisma:** `transaction`, `payment`, `organization`, `auditLog`, etc.
