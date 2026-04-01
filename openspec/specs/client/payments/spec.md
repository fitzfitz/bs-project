# Client: Payment Methods

## Overview

Customer-facing payment methods management page. Lets users view saved cards, add a new card (via Xendit.js tokenization form), and delete saved cards. Replaces the "Coming Soon" badge in the profile page.

## Features

### Payment Methods Page (`/payment-methods`)
- Lists saved payment methods (card type, last 4 digits, expiry, default badge)
- "Add Payment Method" button opens a form with card details
- Delete a card via swipe or button
- Empty state when no methods saved

### Profile Page Integration
- Payment Methods row navigates to `/payment-methods` instead of showing "Coming Soon"

## API Hooks

| Hook | Endpoint | Returns |
|------|----------|---------|
| `usePaymentMethods()` | `GET /payments/methods` | Array of saved methods |
| `useSavePaymentMethod()` | `POST /payments/methods` | Mutation |
| `useDeletePaymentMethod()` | `DELETE /payments/methods/:id` | Mutation |

## Route

`/payment-methods` under `ProtectedRoute` inside `AppLayout`.
