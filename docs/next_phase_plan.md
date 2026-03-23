# TMNG SaaS Platform — Next Phase Plan

> **Created:** Mar 9, 2026
> **Context:** All 7 phases complete. Admin UI & Offline POS Sprint done. This document captures remaining gaps and recommended work for the next development cycle.

---

## Current State Summary

| Metric | Value |
|--------|-------|
| API Feature Modules | 30 |
| API Endpoints | 173 |
| Admin Pages | 22 |
| Client Pages | 14 |
| Prisma Models | 46 |
| Curl Tests Passing | 279/282 (3 skipped — review creation needs prior transaction) |
| Resolved Gaps | 25 of 28 (GAP-01 partial, GAP-02 & GAP-23 open) |
| Phase 4 Completion | 98% (Xendit charge creation remaining) |
| Phase 5–7 | 100% Complete |

---

## Remaining Gaps

### GAP-01: OAuth — Apple Sign In (Partial)

- **Status:** Google OAuth done. Apple OAuth not started.
- **Effort:** 6h
- **Requires:** Apple Developer account ($99/year)
- **Priority:** HIGH if targeting iOS App Store via Capacitor
- **Dependencies:** None (backend pattern already exists for Google)

**Implementation Steps:**
1. Register App ID + Sign in with Apple capability on Apple Developer portal
2. Create a Services ID for web-based Sign in with Apple
3. Install `apple-signin-auth` npm package for server-side token verification
4. Add `POST /api/auth/apple` endpoint (mirror the Google flow)
5. Store `appleId` on User model (add field to schema)
6. Add Apple Sign In button to client login page

---

### GAP-02: Phone Number Verification (OTP)

- **Status:** Not started. `User.phone` field exists but is unverified.
- **Effort:** 6h
- **Priority:** MEDIUM (important for Indonesian market where phone > email)
- **Dependencies:** OTP provider account (Twilio Verify, Vonage, or Firebase Auth)

**Implementation Steps:**
1. Choose OTP provider (Firebase Auth recommended for cost in Indonesia)
2. Add `isPhoneVerified Boolean @default(false)` to User model
3. Create endpoints: `POST /auth/otp/send`, `POST /auth/otp/verify`
4. Add OTP adapter interface for provider swapping
5. Rate limit: max 3 OTP requests per phone per hour
6. Add phone verification UI in client profile settings

---

### GAP-23: Error Tracking (Sentry)

- **Status:** Not started. No error monitoring in any app.
- **Effort:** 3h
- **Priority:** MEDIUM (critical for production debugging)
- **Dependencies:** Sentry account (free tier sufficient)

**Implementation Steps:**
1. Install `@sentry/node` in API, `@sentry/react` in admin and client
2. Add `SENTRY_DSN` env var to all three apps
3. Configure Sentry with environment tagging (dev/staging/production)
4. Add source maps upload to CI/CD pipeline
5. Wire into React error boundaries (both apps)

---

## Partial Implementations to Complete

### P1: Xendit Payment Gateway — Charge Creation

- **Status:** Webhook endpoint works. `xendit-adapter.ts` has `createCharge()` but no exposed API route.
- **Effort:** 4h
- **Priority:** HIGH (required for QRIS/card payment processing)

**Implementation Steps:**
1. Create `POST /api/payments/create-charge` endpoint
2. Accept transaction ID, redirect URLs
3. Call `XenditAdapter.createCharge()` → return invoice URL
4. Frontend: redirect customer to Xendit payment page
5. Webhook already handles completion callback

---

### P2: Server Push Notifications for Core Flows

- **Status:** OneSignal integration works for retention triggers. Not wired to booking confirmations, queue status updates, or appointment reminders.
- **Effort:** 4h
- **Priority:** MEDIUM

**Implementation Steps:**
1. Wire push notification into `queue.service.ts` status transitions (CALLED, COMPLETED)
2. Add booking confirmation push after `createEntry()`
3. Add appointment reminder cron (30 min before scheduled time)
4. Wire into emergency closure flow (notify affected customers)

---

### P3: Commission Template Wiring

- **Status:** Config keys exist (COMMISSION_RATE_MASTER/SENIOR/JUNIOR), UI exists. But `CommissionService` reads from `StaffProfile.commissionRate`, not config.
- **Effort:** 2h
- **Priority:** LOW (config defaults are documentation only until wired)

**Implementation Steps:**
1. When creating a new StaffProfile, default `commissionRate` from config based on tier
2. Add "Reset to Template" button in staff management UI
3. Optionally: fallback to config if StaffProfile.commissionRate is null

---

## New Feature Opportunities

### A. Client App Enhancements

| Feature | Effort | Priority | Description |
|---------|--------|----------|-------------|
| Bell icon notifications | 2h | MEDIUM | Wire notification bell on home page to an in-app notification list |
| Email notification settings | 2h | LOW | Backend endpoint for email preference toggle |
| Payment methods | 8h | HIGH | Display saved payment methods, integrate with Xendit tokenization |
| Footer navigation to legal pages | 1h | LOW | Add links to Terms/Privacy from profile or settings |
| Booking confirmation push | 2h | HIGH | Push notification after successful booking |

### B. Admin App Enhancements

| Feature | Effort | Priority | Description |
|---------|--------|----------|-------------|
| Product management CRUD UI | 4h | MEDIUM | Full product create/edit/delete form (currently API-only CRUD) |
| Staff photo upload | 2h | LOW | Wire MinIO upload to staff profile form |
| Branch image upload | 2h | LOW | Wire MinIO upload to branch settings |
| Dashboard charts | 4h | MEDIUM | Revenue trend charts, booking volume sparklines |
| Bulk payroll operations | 3h | LOW | Select multiple periods, batch approve/disburse |

### C. Platform & Infrastructure

| Feature | Effort | Priority | Description |
|---------|--------|----------|-------------|
| API versioning (/api/v2) | 2h | LOW | Add v2 prefix for future breaking changes (GAP-21) |
| E2E tests (Playwright) | 8h | MEDIUM | Automated browser tests for critical flows |
| Staging environment | 4h | HIGH | Separate staging deployment for pre-release testing |
| Client Docker setup | 2h | LOW | Dockerfile for client app (currently static build only) |
| WhatsApp notifications | 8h | MEDIUM | Pluggable provider for WhatsApp via Twilio/WhatsApp Business API |

### D. Pre-existing Technical Debt

| Item | Effort | Priority | Description |
|------|--------|----------|-------------|
| TypeScript strict errors | 2h | MEDIUM | Fix pre-existing type errors in `auth.service.ts` and `finance.handlers.ts` |
| Remaining `as any` casts | 2h | LOW | Clean up remaining type casts in queue/transaction/promotion handlers |
| Google OAuth JWKS verification | 2h | HIGH | Replace base64 decode with proper server-side JWKS token verification |
| Test suite | 8h | MEDIUM | Add Vitest unit tests for critical services (commission, transaction, queue) |
| `.dev.vars.example` cleanup | 0.5h | LOW | Remove "Wrangler dev" references since API now runs on Node.js |

---

## Recommended Sprint Order

### Sprint 1: Production Readiness (Priority: HIGH)

1. Google OAuth JWKS verification (2h)
2. Sentry error tracking — all 3 apps (3h)
3. Xendit charge creation route (4h)
4. Staging environment setup (4h)
5. Fix pre-existing TypeScript errors (2h)

**Total: ~15h | Impact: Makes the app production-safe**

### Sprint 2: Client Experience (Priority: HIGH)

1. Booking confirmation push notification (2h)
2. Queue status push notifications (2h)
3. Bell icon notification list (2h)
4. Client payment methods display (8h)
5. Appointment reminder cron (2h)

**Total: ~16h | Impact: Significantly improves customer experience**

### Sprint 3: Apple + Phone Auth (Priority: MEDIUM)

1. Apple Sign In (6h)
2. Phone OTP verification (6h)

**Total: ~12h | Impact: Required for iOS App Store + Indonesian market**

### Sprint 4: Admin Polish & Testing (Priority: MEDIUM)

1. Product management CRUD UI (4h)
2. Dashboard charts (4h)
3. E2E Playwright tests (8h)
4. Commission template wiring (2h)
5. Staff/branch photo upload (4h)

**Total: ~22h | Impact: Polishes admin UX, adds test coverage**

---

## Quick Reference: What's Working Now

- 30 API feature modules with 173 endpoints
- Full booking flow (branch → services → barber → time → confirm)
- POS with products, services, 4 payment methods, offline fallback + PWA
- Commission/payroll with 3 calculation models and approval workflow
- Inventory with stock-in/out/adjust
- Real-time queue (Pusher/Soketi)
- Loyalty engine with tiers, referrals, point expiry
- CRM with segmentation, campaigns, retention triggers
- Analytics with 6 dashboards (overview, comparison, heatmap, retention, forecast, utilization)
- Database-driven RBAC with 25 features × CRUD permissions
- Permission-based sidebar and route guards
- PWA with service worker caching for both admin and client apps
- Audit logging with anomaly detection
- 279 curl tests passing
