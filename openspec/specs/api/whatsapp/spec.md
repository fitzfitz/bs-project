# WhatsApp Notification Provider

## Overview

Extends the existing `NotificationService` with a pluggable WhatsApp channel using Twilio's WhatsApp Business API. Notifications can be sent via push (OneSignal), WhatsApp, or both, depending on organization-level channel toggles and per-user preferences. The design follows the same graceful-degradation pattern as the existing push service: when credentials are absent, WhatsApp messages are logged to console.

## Architecture

### Adapter Pattern

The existing `NotificationService` interface gains a new method `sendWhatsApp`. A new `WhatsAppAdapter` implements the Twilio WhatsApp API call. The factory `createNotificationService(env)` returns both `sendPush` and `sendWhatsApp`.

```
NotificationService
├── sendPush(userId, title, body, data?)     ← existing (OneSignal)
└── sendWhatsApp(phone, templateId, vars?)   ← new (Twilio WhatsApp)
```

### Channel Resolution

When a feature triggers a notification (e.g., queue CALLED, booking confirmed), the caller:
1. Checks the org-level `NotificationChannelConfig` for that `notificationType` (e.g., `BOOKING_CONFIRMED`)
2. If `pushEnabled`, sends push via `sendPush`
3. If `whatsappEnabled`, resolves the user's phone number and sends via `sendWhatsApp`
4. User-level `NotificationPreference` can override: if user has `whatsappOptOut: true`, skip WhatsApp for that user

### Env Config Keys

| Key | Required | Description |
|-----|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Optional | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Optional | Twilio WhatsApp sender number (e.g., `whatsapp:+14155238886`) |

When all three are absent, `sendWhatsApp` logs to console and returns `false` (same pattern as OneSignal).

## Database Changes

### NotificationChannelConfig (new model)

Per-organization, per-notification-type channel toggles.

```prisma
model NotificationChannelConfig {
  id               String       @id @default(cuid())
  organizationId   String
  notificationType String       // e.g. BOOKING_CONFIRMED, QUEUE_CALLED, QUEUE_COMPLETED, APPOINTMENT_REMINDER
  pushEnabled      Boolean      @default(true)
  whatsappEnabled  Boolean      @default(false)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, notificationType])
  @@map("notification_channel_configs")
}
```

### NotificationPreference (new model)

Per-user opt-out preferences.

```prisma
model NotificationPreference {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  pushOptOut     Boolean  @default(false)
  whatsappOptOut Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("notification_preferences")
}
```

## API Endpoints

### Admin — Channel Config

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications/channels` | Bearer + org + `ORG_SETTINGS` read | List all channel configs for the org |
| PUT | `/api/notifications/channels/{notificationType}` | Bearer + org + `ORG_SETTINGS` update | Upsert channel config (pushEnabled, whatsappEnabled) |

### Client — User Preference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications/preferences` | Bearer + org | Get current user's notification preferences |
| PUT | `/api/notifications/preferences` | Bearer + org | Update current user's preferences (pushOptOut, whatsappOptOut) |

## Request / Response Shapes

### PUT `/api/notifications/channels/{notificationType}`

**Request:**
```json
{
  "pushEnabled": true,
  "whatsappEnabled": true
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "notificationType": "BOOKING_CONFIRMED",
    "pushEnabled": true,
    "whatsappEnabled": true
  }
}
```

### GET `/api/notifications/preferences`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "pushOptOut": false,
    "whatsappOptOut": false
  }
}
```

### PUT `/api/notifications/preferences`

**Request:**
```json
{
  "pushOptOut": false,
  "whatsappOptOut": true
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "pushOptOut": false,
    "whatsappOptOut": true
  }
}
```

## Business Rules

1. **Graceful degradation**: If Twilio env vars are absent, `sendWhatsApp` returns `false` and logs to console. No errors thrown.
2. **Channel resolution order**: Push checked first, then WhatsApp. Both may fire for the same event if both are enabled.
3. **User opt-out**: `NotificationPreference.whatsappOptOut = true` prevents WhatsApp for that user regardless of org config.
4. **Phone number required**: WhatsApp requires a valid phone number on the `User` record. If `user.phone` is null or empty, WhatsApp is silently skipped.
5. **Twilio WhatsApp format**: Phone numbers are sent in `whatsapp:+{phone}` format. Template IDs are Twilio content SIDs.
6. **Notification types**: `BOOKING_CONFIRMED`, `QUEUE_CALLED`, `QUEUE_COMPLETED`, `APPOINTMENT_REMINDER`. More can be added later.
7. **Default configs**: When an org has no `NotificationChannelConfig` for a type, default to `pushEnabled: true, whatsappEnabled: false`.
8. **Admin toggle**: Only users with `ORG_SETTINGS` update permission can toggle channels.
9. **Existing push behavior preserved**: Adding WhatsApp does not change existing push notification behavior. The `sendPush` method remains unchanged.

## Scenarios

### Success

- **GIVEN** Twilio env vars configured and org has `whatsappEnabled: true` for `BOOKING_CONFIRMED` **WHEN** booking created for user with phone **THEN** WhatsApp message sent via Twilio API.
- **GIVEN** admin with `ORG_SETTINGS` update **WHEN** `PUT /channels/BOOKING_CONFIRMED` with `whatsappEnabled: true` **THEN** `200` with updated config.
- **GIVEN** authenticated customer **WHEN** `PUT /preferences` with `whatsappOptOut: true` **THEN** `200` with updated preferences.
- **GIVEN** user with `whatsappOptOut: true` **WHEN** WhatsApp notification triggered **THEN** WhatsApp skipped; push still sent if enabled.

### Failure

- **GIVEN** no Twilio env vars **WHEN** WhatsApp message triggered **THEN** logged to console, returns `false`.
- **GIVEN** user with no phone number **WHEN** WhatsApp notification triggered **THEN** silently skipped.
- **GIVEN** Twilio API returns error **WHEN** sending WhatsApp **THEN** error logged, returns `false`.
- **GIVEN** no `ORG_SETTINGS` update permission **WHEN** `PUT /channels/{type}` **THEN** `403`.
- **GIVEN** no JWT **WHEN** any endpoint **THEN** `401`.

## Service-Level Test Scenarios

### WhatsAppAdapter

- Configured: sends POST to Twilio API with correct auth and body format; returns `true`.
- Not configured (missing env): logs to console, returns `false`.
- Twilio API error (non-200): logs error, returns `false`.
- Network error (fetch throws): logs error, returns `false`.

### Channel Resolution (sendNotification helper)

- Both push and WhatsApp enabled, user has phone, no opt-outs → both fire.
- Only push enabled → only push fires.
- WhatsApp enabled but user has no phone → only push fires.
- WhatsApp enabled but user opted out → only push fires.
- Both enabled but push opted out → only WhatsApp fires.
- No config for notification type → defaults to push only.

### Admin Channel Config API

- GET returns all configs for org (may be empty array).
- PUT upserts config: creates if not exists, updates if exists.
- PUT without `ORG_SETTINGS` update → 403.
- Invalid notification type in body → validation error.

### Client Preference API

- GET returns current user preferences (creates default if not exists).
- PUT updates preferences.
- Unauthenticated → 401.

## RBAC

| Endpoint | Permission |
|----------|-----------|
| `GET /channels` | `ORG_SETTINGS` read |
| `PUT /channels/{type}` | `ORG_SETTINGS` update |
| `GET /preferences` | Authenticated (any role) |
| `PUT /preferences` | Authenticated (any role) |

## Dependencies

- **Twilio**: WhatsApp Business API via REST (no SDK needed; plain fetch).
- **Prisma**: `NotificationChannelConfig`, `NotificationPreference`, `User` (for phone), `Notification` (for inbox record).
- **Existing**: `createNotificationService` extended with `sendWhatsApp`.

## Implementation Order

1. Add Prisma models (`NotificationChannelConfig`, `NotificationPreference`) + migration
2. Add Twilio env vars to `env.ts` (optional)
3. Extend `NotificationService` interface with `sendWhatsApp` method
4. Implement `WhatsAppAdapter` in `notifications.ts` (Twilio REST)
5. Create `sendNotification` helper that resolves channels and preferences
6. Add admin channel config endpoints to `notifications.index.ts`
7. Add client preference endpoints to `notifications.index.ts`
8. Update queue/booking callers to use `sendNotification` instead of direct `sendPush`
