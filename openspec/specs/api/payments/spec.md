# API: Payments (Xendit)

## Overview

Payment gateway integration with Xendit. Two endpoints: charge creation (initiates a Xendit invoice for online payment) and webhook (processes Xendit callbacks on payment status changes).

## API Endpoints

Base path: `/api/payments`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/create-charge` | Bearer + TRANSACTION create | Create a Xendit invoice for a pending transaction; returns `invoiceUrl` for customer redirect. |
| POST | `/webhook` | Xendit callback token | JSON body `{ id, external_id, status }`; header `x-callback-token`. |

## POST `/create-charge`

**Request** (`application/json`):

```json
{
  "transactionId": "string",
  "successRedirectUrl": "string (URL)",
  "failureRedirectUrl": "string (URL)"
}
```

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "invoiceId": "string (Xendit invoice ID)",
    "invoiceUrl": "string (URL for customer redirect)"
  }
}
```

## Business Rules

### Create Charge

- **Auth**: Bearer JWT + `requirePermission("TRANSACTION", "create")`.
- **Transaction lookup**: Must exist and have `status === "PENDING"`. Not found -> `404`. Already completed -> `400`.
- **Xendit config**: `XENDIT_SECRET_KEY` must be set. Missing -> `400` "Payment gateway not configured".
- **Xendit API call**: `POST https://api.xendit.co/v2/invoices` with Basic auth (`XENDIT_SECRET_KEY:`), body includes `external_id` (transactionId), `amount` (totalDue), `success_redirect_url`, `failure_redirect_url`.
- **Payment record**: Creates a `Payment` row with `method: CARD`, `amount: totalDue`, `reference: xenditInvoiceId`.
- **Xendit failure**: Gateway error -> `500` "Payment gateway error".

### Webhook

- **Auth**: Not tenant JWT -- shared secret header only.
- **Token**: If `XENDIT_WEBHOOK_TOKEN` env unset or header mismatch -> `401` "Invalid callback token".
- **JSON**: Malformed body -> `400` "Invalid JSON".
- **Non-PAID statuses**: Immediately `200` `{ success: true }` (no DB finalize).
- **PAID**: Find `payment` where `reference === body.id`. If none -> `200` (idempotent no-op). If finalize throws -> `500` "Internal server error".
- **Finalize**: Only updates if transaction exists and `status === "PENDING"` (see `TransactionService.finalizeTransactionOnPaid`).

## Scenarios

### Success

- **GIVEN** valid auth, pending transaction, configured Xendit **WHEN** POST `/create-charge` **THEN** `201` with `invoiceId` and `invoiceUrl`.
- **GIVEN** valid callback token and `status: "EXPIRED"` **WHEN** POST `/webhook` **THEN** `200`, no finalize.
- **GIVEN** valid token, `PAID`, matching `Payment.reference` **WHEN** POST `/webhook` **THEN** `200` after finalize.

### Failure

- **GIVEN** no Bearer token **WHEN** POST `/create-charge` **THEN** `401`.
- **GIVEN** transaction not found **WHEN** POST `/create-charge` **THEN** `404`.
- **GIVEN** transaction already completed **WHEN** POST `/create-charge` **THEN** `400`.
- **GIVEN** `XENDIT_SECRET_KEY` not configured **WHEN** POST `/create-charge` **THEN** `400`.
- **GIVEN** Xendit API failure **WHEN** POST `/create-charge` **THEN** `500`.
- **GIVEN** wrong or missing callback token **WHEN** POST `/webhook` **THEN** `401`.
- **GIVEN** invalid JSON **WHEN** POST `/webhook` **THEN** `400`.

## Edge Cases

- Webhook uses raw `c.var.db` from parent app (not org-scoped extension).
- Duplicate webhook deliveries: second PAID may no-op if transaction already non-`PENDING`.
- Create charge is idempotent in practice -- creating a second invoice for the same transaction is allowed (Xendit treats each as separate).

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| `/create-charge` | `TRANSACTION` **create** |
| `/webhook` | None (provider secret only) |

## Dependencies

- **Env**: `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`
- **Prisma**: `transaction`, `payment`
- **Services**: `TransactionService.finalizeTransactionOnPaid`
- **External**: Xendit Invoice API v2 (`https://api.xendit.co/v2/invoices`)
