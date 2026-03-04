# OneSignal Setup Guide

> Push notifications for the Barber Project — client PWA (web push) and server-side API (transactional messages).

## Pricing

OneSignal's **Free plan ($0/month)** covers everything this project needs:

- Unlimited mobile push sends
- Web push to up to **10,000 subscribers** per send
- 10,000 email sends/month
- External User ID targeting
- A/B testing, GDPR compliance

Growth plan ($19/mo) only needed if you exceed 10,000 web push subscribers.

---

## 1. Create a OneSignal App

1. Go to [onesignal.com](https://onesignal.com) and create an account
2. Click **New App/Website**
3. Enter app name: `Barber Project`
4. Select platform: **Web**
5. Choose integration: **Custom Code**
6. Configure site:
   - **Site URL:** `https://your-client-domain.com` (your production client URL)
   - **Default Icon URL:** Upload your app icon (recommended 256x256 PNG)
   - **Permission Prompt:** Enable the Slide Prompt (less intrusive than the native browser prompt)
7. Save configuration

After setup, note these values from **Settings > Keys & IDs**:

| Key | Where to use |
|-----|-------------|
| **App ID** | Client app (`VITE_ONESIGNAL_APP_ID`) |
| **REST API Key** | API backend (`ONESIGNAL_REST_API_KEY`) |

---

## 2. Client App Setup (Web Push)

### 2a. Service Worker File

OneSignal requires a service worker file served from your app's origin. Create this file:

**`apps/client/public/OneSignalSDKWorker.js`**

```javascript
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

This file must be publicly accessible at `https://your-domain.com/OneSignalSDKWorker.js`.

> If you later add a PWA service worker (Workbox/vite-plugin-pwa), place the OneSignal worker in a subdirectory like `/push/onesignal/OneSignalSDKWorker.js` and configure the path in the OneSignal dashboard under **Advanced Push Settings > Customize service worker paths**.

### 2b. Environment Variable

Add to `apps/client/.env`:

```env
VITE_ONESIGNAL_APP_ID=your-actual-app-id-here
```

### 2c. NotificationProvider (Already Exists)

The client app already has a working `NotificationProvider` at `apps/client/src/components/providers/NotificationProvider.tsx`. It:

- Initializes OneSignal SDK on mount
- Binds the user's backend ID as the OneSignal External User ID via `OneSignal.login(user.id)`
- Logs out on sign-out via `OneSignal.logout()`
- Exposes `promptPushOption()` and `enablePush()` to child components

**No changes needed** — just replace the stub App ID in `.env` with your real one.

### 2d. Prompting Users for Permission

The notification settings page at `apps/client/src/pages/profile/notification-settings-page.tsx` already has a push toggle. When the user enables it, it calls `promptPushOption()` which triggers the browser's native permission dialog.

Best practice: Don't prompt immediately on first visit. Wait until a meaningful moment:
- After booking confirmation ("Get notified when it's your turn?")
- On the notification settings page (existing)
- After a few visits (soft prompt first, then native prompt)

---

## 3. API Backend Setup (Server-Side Push)

This is the part that's **not yet implemented** (GAP-13). Here's how to build it.

### 3a. Environment Variables

Add to `apps/api/.dev.vars` (local dev) or Docker env / `/opt/barber/.env` (production):

```env
ONESIGNAL_APP_ID=your-actual-app-id-here
ONESIGNAL_REST_API_KEY=your-rest-api-key-here
```

Add to `apps/api/src/types.ts` (or wherever `Bindings` is defined):

```typescript
interface Bindings {
  // ... existing bindings
  ONESIGNAL_APP_ID: string;
  ONESIGNAL_REST_API_KEY: string;
}
```

### 3b. Notification Service

Create `apps/api/src/utils/notifications.ts`:

```typescript
interface SendPushOptions {
  userIds: string[];          // Backend User IDs (bound as External IDs in client)
  title: string;
  message: string;
  url?: string;               // Deep link URL when notification is clicked
  data?: Record<string, string>;
}

export function createNotificationService(appId: string, apiKey: string) {
  async function sendPush(options: SendPushOptions): Promise<void> {
    const body = {
      app_id: appId,
      include_aliases: {
        external_id: options.userIds,
      },
      target_channel: "push",
      headings: { en: options.title },
      contents: { en: options.message },
      ...(options.url && { url: options.url }),
      ...(options.data && { data: options.data }),
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OneSignal push failed:", response.status, error);
    }
  }

  return { sendPush };
}
```

### 3c. Wire into Existing Flows

Initialize in the database middleware or a dedicated middleware in `apps/api/src/index.ts`:

```typescript
import { createNotificationService } from "./utils/notifications";

// Inside middleware:
const notifications = createNotificationService(
  c.env.ONESIGNAL_APP_ID,
  c.env.ONESIGNAL_REST_API_KEY
);
c.set("notifications", notifications);
```

Then use in feature handlers:

**Queue status change** — `queue.service.ts`:
```typescript
// When status changes to CALLED:
if (newStatus === "CALLED" && entry.customerId) {
  notifications.sendPush({
    userIds: [entry.customerId],
    title: "It's almost your turn!",
    message: "Please head to the counter.",
    url: "/history",
  });
}
```

**Booking confirmation** — `queue.service.ts` (after createEntry):
```typescript
if (customerId) {
  notifications.sendPush({
    userIds: [customerId],
    title: "Booking Confirmed",
    message: `Your appointment is set for ${scheduledTime}.`,
    url: "/history",
  });
}
```

**Transaction complete** — `transactions.service.ts` (after PAID):
```typescript
if (transaction.customerId) {
  notifications.sendPush({
    userIds: [transaction.customerId],
    title: "Payment Received",
    message: `Thank you! You earned ${pointsEarned} loyalty points.`,
    url: "/profile",
  });
}
```

---

## 4. Notification Events for This Project

| Event | Trigger Point | Target | Message |
|-------|--------------|--------|---------|
| Booking confirmed | `queue.service.createEntry()` | Customer | "Booking confirmed for {time}" |
| Queue position called | `queue.service.updateStatus(CALLED)` | Customer | "It's almost your turn!" |
| Service started | `queue.service.updateStatus(IN_CHAIR)` | Customer | "Your service has started" |
| Payment received | `transactions.service.finalizeTransactionOnPaid()` | Customer | "Payment received. You earned {n} points" |
| Booking cancelled | `queue.service.cancelEntry()` | Customer | "Your booking has been cancelled" |
| No-show timeout | Future: Cron trigger (GAP-08) | Customer | "Missed your turn? Book again!" |
| Low stock alert | `inventory.service.recordStockOut()` | Manager | "{product} is running low ({qty} left)" |
| Payroll approved | `payroll.service.approve()` | Barber | "Your payroll for {period} has been approved" |

---

## 5. Testing Locally

1. OneSignal **requires HTTPS** in production but allows localhost during development if you pass `allowLocalhostAsSecureOrigin: true` in the init config (already set in `NotificationProvider.tsx`).

2. To test locally:
   - Set `VITE_ONESIGNAL_APP_ID` in `.env` to your real App ID
   - Run the client app: `pnpm --filter @tmng/barber-client dev`
   - Open Chrome (Firefox and Safari also work but Chrome is easiest for debugging)
   - Log in as a customer — OneSignal will bind the user's External ID
   - Accept the push permission prompt
   - Use the OneSignal dashboard **Messages > New Push** to send a test notification

3. To test server-side sending, use curl:

```bash
curl -X POST https://onesignal.com/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Key YOUR_REST_API_KEY" \
  -d '{
    "app_id": "YOUR_APP_ID",
    "include_aliases": { "external_id": ["USER_ID_FROM_DB"] },
    "target_channel": "push",
    "headings": { "en": "Test Notification" },
    "contents": { "en": "This is a test push from the API." }
  }'
```

---

## 6. Production Checklist

- [ ] OneSignal app created with correct site URL
- [ ] `OneSignalSDKWorker.js` deployed to `public/` and accessible at root
- [ ] `VITE_ONESIGNAL_APP_ID` set in frontend build environment (`.env` or CI)
- [ ] `ONESIGNAL_REST_API_KEY` and `ONESIGNAL_APP_ID` set in API server environment (`.dev.vars` locally, Docker env in production)
- [ ] Permission prompt configured (Slide Prompt recommended over native prompt)
- [ ] Server-side `createNotificationService` wired into middleware
- [ ] Key flows sending notifications (booking confirm, queue called, payment received)
- [ ] Safari support: OneSignal handles Safari push automatically (no extra config needed)
- [ ] Test on Chrome, Firefox, Safari, and mobile browsers
