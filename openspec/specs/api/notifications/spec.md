# Notifications API

## Overview

Multi-channel notification system: in-app inbox, push (OneSignal), WhatsApp (Twilio), and SMS (Twilio). Provides user inbox endpoints, admin management endpoints, org-level channel configuration, and per-user preference toggles.

**Base path:** `/api/notifications`

## API Endpoints

### User Inbox

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer + org scope | List current user's notifications (paginated, newest first) |
| GET | `/unread-count` | Bearer + org scope | Count of unread notifications for current user |
| PATCH | `/:id/read` | Bearer + org scope | Mark a single notification as read |
| POST | `/mark-all-read` | Bearer + org scope | Mark all of current user's notifications as read |

### Admin

| Method | Path | Auth | RBAC | Description |
|--------|------|------|------|-------------|
| GET | `/admin` | Bearer + org scope | CAMPAIGNS.read | Org-wide notification list (paginated) |
| GET | `/admin/stats` | Bearer + org scope | CAMPAIGNS.read | Aggregate stats (total, unread, read rate, common type) |
| POST | `/admin/test-send` | Bearer + org scope | CAMPAIGNS.create | Send a test push notification to a specific user |

### Channel Config (org-level)

| Method | Path | Auth | RBAC | Description |
|--------|------|------|------|-------------|
| GET | `/channels` | Bearer + org scope | ORG_SETTINGS.read | List all notification channel configs |
| PUT | `/channels/{notificationType}` | Bearer + org scope | ORG_SETTINGS.update | Upsert channel config for a notification type |

### User Preferences

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/preferences` | Bearer + org scope | Get current user's notification preferences |
| PUT | `/preferences` | Bearer + org scope | Update current user's notification preferences |

## Request / Response Shapes

### GET `/` — list notifications

**Query:** `page` (default 1), `limit` (default 20, max 50).

**Response** `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "title": "string",
      "body": "string",
      "type": "string",
      "data": {},
      "read": false,
      "createdAt": "string (ISO)"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### GET `/unread-count`

**Response** `200`:

```json
{ "success": true, "data": { "count": 5 } }
```

### PATCH `/:id/read`

**Response** `200`:

```json
{ "success": true, "data": { "id": "string", "read": true } }
```

### POST `/mark-all-read`

**Response** `200`:

```json
{ "success": true, "data": { "updated": 10 } }
```

### GET `/channels`

**Response** `200`:

```json
{
  "success": true,
  "data": [
    {
      "notificationType": "BOOKING_CONFIRMED",
      "pushEnabled": true,
      "whatsappEnabled": false,
      "smsEnabled": false
    }
  ]
}
```

### PUT `/channels/{notificationType}`

**Body:**

```json
{ "pushEnabled": true, "whatsappEnabled": false, "smsEnabled": false }
```

**Response** `200`:

```json
{
  "success": true,
  "data": { "notificationType": "BOOKING_CONFIRMED", "pushEnabled": true, "whatsappEnabled": false, "smsEnabled": false }
}
```

### GET `/preferences`

**Response** `200`:

```json
{
  "success": true,
  "data": { "pushOptOut": false, "whatsappOptOut": false, "smsOptOut": false }
}
```

### PUT `/preferences`

**Body:**

```json
{ "pushOptOut": false, "whatsappOptOut": false, "smsOptOut": false }
```

**Response** `200`: same shape as GET.

### POST `/admin/test-send`

**Body:**

```json
{ "userId": "string", "title": "string", "body": "string", "type": "TEST" }
```

**Response** `200`:

```json
{ "success": true, "data": { "notificationId": "string", "pushSent": true } }
```

## Notification Providers

| Provider | Channel | Env Vars | Graceful Degradation |
|----------|---------|----------|----------------------|
| OneSignal | Push | `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Logs no-op when absent |
| Twilio | WhatsApp | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Logs no-op when absent |
| Twilio | SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | Logs no-op when absent |

All providers are implemented in `utils/notifications.ts` via the `NotificationService` interface:

```typescript
interface NotificationService {
  sendPush(userId: string, title: string, body: string, data?: Record<string, string>): Promise<boolean>;
  sendWhatsApp(phone: string, templateId: string, vars?: Record<string, string>): Promise<boolean>;
  sendSms(phone: string, body: string): Promise<boolean>;
}
```

SMS uses the Twilio Messages API (`POST /2010-04-01/Accounts/{SID}/Messages.json`) with `From`/`To` (E.164 format) and `Body` (plain text). Reuses the same `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` as WhatsApp.

## Business Rules

1. All inbox endpoints require authentication (Bearer JWT + org scope).
2. Notifications are always scoped to the authenticated user's `userId`.
3. No RBAC feature permission is required for inbox or preferences (personal data).
4. Channel config requires `ORG_SETTINGS` permission. Admin endpoints require `CAMPAIGNS` permission.
5. Marking an already-read notification as read is a no-op (idempotent, returns 200).
6. Notification records are created server-side by queue lifecycle events, campaigns, retention, and the appointment reminder cron. There is no client-facing "create notification" endpoint.
7. Channel config toggles (`pushEnabled`, `whatsappEnabled`, `smsEnabled`) control org-level delivery policy per notification type.
8. User preferences (`pushOptOut`, `whatsappOptOut`, `smsOptOut`) allow individual opt-out from each channel.

## Scenarios

### Success — Inbox

- **GIVEN** an authenticated user with notifications **WHEN** `GET /` **THEN** `200` with paginated list (newest first).
- **GIVEN** an authenticated user **WHEN** `GET /unread-count` **THEN** `200` with `{ count }`.
- **GIVEN** a notification owned by the user **WHEN** `PATCH /:id/read` **THEN** `200` with `{ id, read: true }`.
- **GIVEN** multiple unread notifications **WHEN** `POST /mark-all-read` **THEN** `200` with `{ updated: N }`.

### Success — Channel Config

- **GIVEN** ORG_SETTINGS.read permission **WHEN** `GET /channels` **THEN** `200` with channel config list.
- **GIVEN** ORG_SETTINGS.update permission **WHEN** `PUT /channels/BOOKING_CONFIRMED` with `{ pushEnabled: true, smsEnabled: true }` **THEN** `200` with upserted config.

### Success — Preferences

- **GIVEN** authenticated user **WHEN** `GET /preferences` **THEN** `200` with defaults (`pushOptOut: false, whatsappOptOut: false, smsOptOut: false`) if no record exists.
- **GIVEN** authenticated user **WHEN** `PUT /preferences` with `{ smsOptOut: true }` **THEN** `200` with updated preferences.

### Success — SMS Provider

- **GIVEN** `TWILIO_SMS_FROM` is configured **WHEN** `sendSms("+6281200000001", "Your booking is confirmed")` **THEN** POST to Twilio Messages API, returns `true`.
- **GIVEN** `TWILIO_SMS_FROM` is absent **WHEN** `sendSms(...)` **THEN** logs no-op, returns `false`.

### Failure

- **GIVEN** no Authorization header **WHEN** any endpoint **THEN** `401`.
- **GIVEN** notification ID not owned by user **WHEN** `PATCH /:id/read` **THEN** `404`.
- **GIVEN** non-existent notification ID **WHEN** `PATCH /:id/read` **THEN** `404`.
- **GIVEN** no ORG_SETTINGS permission **WHEN** `GET /channels` or `PUT /channels/:type` **THEN** `403`.
- **GIVEN** Twilio returns error **WHEN** `sendSms(...)` **THEN** logs error, returns `false`.
- **GIVEN** network failure **WHEN** `sendSms(...)` **THEN** logs error, returns `false`.

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| Inbox (GET /, unread-count, PATCH read, mark-all-read) | Authenticated + org scope (no feature permission) |
| Preferences (GET/PUT /preferences) | Authenticated + org scope (no feature permission) |
| Channel config (GET/PUT /channels) | ORG_SETTINGS.read / ORG_SETTINGS.update |
| Admin (GET /admin, stats, test-send) | CAMPAIGNS.read / CAMPAIGNS.create |

## Dependencies

- **Prisma:** `Notification`, `NotificationChannelConfig`, `NotificationPreference` models
- **Auth:** `userId`, `organizationId` from JWT claims
- **External:** OneSignal (push), Twilio (WhatsApp + SMS)
