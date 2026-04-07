# Client: Notifications

## Overview

In-app notification inbox for the customer PWA. Shows a list of notifications (booking confirmations, queue status updates, appointment reminders, campaigns). The bell icon on the home page navigates to the notification list and displays an unread count badge.

## Features

### Notification List Page (`/notifications`)
- Displays notifications in reverse chronological order
- Each notification shows: title, body, relative timestamp, read/unread indicator
- Tap to mark as read
- "Mark all as read" action in the header
- Pull-to-refresh or refetch on mount
- Empty state when no notifications

### Bell Icon (Home Page Header)
- Navigates to `/notifications` on tap
- Shows unread count badge (red dot with number) when count > 0
- Badge hidden when count is 0
- Uses `GET /notifications/unread-count` to fetch count

## API Hooks

| Hook | Endpoint | Returns |
|------|----------|---------|
| `useNotificationList(page)` | `GET /notifications?page=N&limit=20` | Paginated notifications |
| `useUnreadCount()` | `GET /notifications/unread-count` | `{ count: number }` |
| `useMarkRead()` | `PATCH /notifications/:id/read` | Mutation |
| `useMarkAllRead()` | `POST /notifications/mark-all-read` | Mutation |

## Route

`/notifications` under `ProtectedRoute` inside `AppLayout`.

## Notification Settings (`/settings/notifications`)

- Toggle controls for: Push, WhatsApp, SMS, Email
- Each toggle maps to `PUT /notifications/preferences` `{ pushOptOut, whatsappOptOut, smsOptOut, emailOptOut }`
- Email toggle added in GAP-38

## OneSignal Email Registration

- On login, `NotificationProvider` calls `OneSignal.User.addEmail(user.email)` to register the email address on the OneSignal profile
- This enables OneSignal to target the user via the email channel using the same `external_id` (userId)
- On logout, `OneSignal.logout()` clears the association
