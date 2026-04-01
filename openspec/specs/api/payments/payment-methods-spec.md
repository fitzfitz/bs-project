# Payment Methods API

## Overview

Saved payment methods for customers. Allows listing, adding (via Xendit tokenization), and deleting saved payment methods. Each method stores a Xendit token reference, card type, and last 4 digits for display.

**Base path:** `/api/payments/methods`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/methods` | Bearer + org scope | List current user's saved payment methods |
| POST | `/methods` | Bearer + org scope | Save a new tokenized payment method via Xendit |
| DELETE | `/methods/:id` | Bearer + org scope | Remove a saved payment method |

## Request / Response Shapes

### GET `/methods`

**Response** `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "type": "CARD",
      "last4": "4242",
      "expiryMonth": 12,
      "expiryYear": 2028,
      "isDefault": true,
      "createdAt": "string (ISO)"
    }
  ]
}
```

### POST `/methods`

**Request:**

```json
{
  "tokenId": "string (Xendit token ID from client-side Xendit.js)",
  "type": "CARD",
  "last4": "4242",
  "expiryMonth": 12,
  "expiryYear": 2028,
  "isDefault": false
}
```

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "id": "string",
    "type": "CARD",
    "last4": "4242",
    "expiryMonth": 12,
    "expiryYear": 2028,
    "isDefault": false
  }
}
```

### DELETE `/methods/:id`

**Response** `200`:

```json
{
  "success": true,
  "data": { "id": "string" }
}
```

## Business Rules

1. All endpoints scoped to `userId` from JWT — users can only manage their own payment methods.
2. No RBAC feature permission needed (personal data, same as notifications).
3. When `isDefault: true` is set on a new method, all other methods for that user are unset.
4. Maximum 5 saved payment methods per user.
5. The `tokenId` comes from Xendit.js client-side tokenization — the server stores it but does not call Xendit to create the token (that happens in the browser).

## Scenarios

### Success

- **GIVEN** authenticated user **WHEN** `GET /methods` **THEN** `200` with array (may be empty).
- **GIVEN** valid tokenId + card details **WHEN** `POST /methods` **THEN** `201` with saved method.
- **GIVEN** method owned by user **WHEN** `DELETE /methods/:id` **THEN** `200`.

### Failure

- **GIVEN** no auth **WHEN** any endpoint **THEN** `401`.
- **GIVEN** user already has 5 methods **WHEN** `POST /methods` **THEN** `400` "Maximum payment methods reached".
- **GIVEN** method not owned by user **WHEN** `DELETE /methods/:id` **THEN** `404`.

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| All | Authenticated + org scope (no feature permission) |

## Dependencies

- **Prisma:** `paymentMethod` model (new)
- **Auth:** `userId` from JWT
