# API Feature: Authentication (`/api/auth`)

## Overview

Customer and staff authentication: registration and login (email/password and Google ID token), JWT access tokens and refresh-token rotation, current-user profile (`/me`), password reset request (stub), admin user search, and account deletion. Responses use the standard `{ success, data?, message? }` envelope.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register a new **customer** in an organization; returns user, permissions map, access + refresh tokens. |
| POST | `/login` | No | Email/password login for the organization; returns user, permissions, tokens. |
| POST | `/refresh` | No | Validate refresh token, rotate refresh token, issue new access + refresh tokens. |
| POST | `/forgot-password` | No | Request password reset; always returns a generic success message (no enumeration). |
| POST | `/google` | No | Login or register via Google ID token (server-side JWKS verification via `google-auth-library`). |
| GET | `/me` | Bearer | Current user profile (includes permissions when `tenantRoleId` present). |
| PATCH | `/me` | Bearer | Update current user profile fields (`firstName`, `lastName`, `phone`). |
| DELETE | `/me` | Bearer | Soft-delete / anonymize account; body must be `{ "confirm": "DELETE" }`. |
| PATCH | `/me/notification-preferences` | Bearer | Update notification preferences (`emailOptIn`). Returns updated preference values. |
| GET | `/users` | Bearer + RBAC | Search users by name/email; optional `excludeBarbers=true` excludes users with a `staffProfile`. |

Organization is resolved from `orgSlug` in the JSON body or `X-Org-Slug` header (required for register, login, google).

## Request / response shapes (selected endpoints)

### POST `/register`

**Request** (`application/json`):

```json
{
  "orgSlug": "string (optional if X-Org-Slug header set)",
  "email": "user@example.com",
  "password": "string (min 8)",
  "firstName": "string",
  "lastName": "string",
  "phone": "string (optional)"
}
```

**Response** `201` (`application/json`):

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phone": "string | null",
      "organizationId": "string",
      "tenantRoleId": "string",
      "isCustomer": true,
      "permissions": { "FEATURE_CODE": { "read": true, "create": false } }
    },
    "accessToken": "string (JWT)",
    "refreshToken": "string"
  }
}
```

### POST `/login`

**Request** (`application/json`):

```json
{
  "orgSlug": "string (optional if X-Org-Slug header set)",
  "email": "user@example.com",
  "password": "string"
}
```

**Response** `200` (`application/json`): same `data` shape as register (`user`, `accessToken`, `refreshToken`). `user` may include `branchId`, `tenantRole`, and `permissions` per role.

### POST `/refresh`

**Request** (`application/json`):

```json
{
  "refreshToken": "string (non-empty)"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)",
    "refreshToken": "string (new rotated token)"
  }
}
```

### GET `/me`

**Request:** no body; `Authorization: Bearer <accessToken>`.

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "phone": "string | null",
    "tenantRoleId": "string | null",
    "branchId": "string | null",
    "isCustomer": "boolean",
    "organizationId": "string",
    "staffProfile": { "id": "string", "tier": "string" } | null,
    "tenantRole": { "id": "string", "name": "string", "scope": "string" } | null,
    "permissions": { "FEATURE_CODE": { "read": true } }
  }
}
```

When `tenantRoleId` is null, `permissions` may be omitted (service returns user without merging permissions).

### POST `/google`

**Request** (`application/json`):

```json
{
  "orgSlug": "string (optional if X-Org-Slug header set)",
  "idToken": "string (Google ID token, non-empty)"
}
```

**Response** `200` (`application/json`): same envelope as login (`data.user`, `accessToken`, `refreshToken`).

## Business Rules

1. **Tenant resolution:** `orgSlug` must be provided (body or header) for register, login, and google; otherwise **400** with a clear message.
2. **Register:** Organization must exist; a `TenantRole` with `scope: CUSTOMER` must exist; email must be unique per organization; password hashed with bcrypt; `CustomerMembership` created with default tier/points.
3. **Login:** User must exist for org/email; must have `passwordHash`; bcrypt must match; otherwise **400** “Invalid credentials”. If `passwordHash` is missing, service throws (social-only account).
4. **Refresh:** Token must exist, not expired; old refresh token revoked; new pair issued. Invalid/expired → **401**.
5. **Me:** Requires `userId` from JWT; if user missing → **401** “User not found”.
6. **Delete account:** Requires `confirm: "DELETE"` literal; revokes refresh tokens, removes customer membership, anonymizes user, sets inactive, writes audit log.
7. **Google:** The `idToken` is verified server-side using `google-auth-library`'s `OAuth2Client.verifyIdToken()`. The `aud` claim must match the configured `GOOGLE_CLIENT_ID` env var. The `iss` claim must be `accounts.google.com` or `https://accounts.google.com`. If `GOOGLE_CLIENT_ID` is not configured, the endpoint returns **400** "Google auth not configured". Verified payload must include `email`; links by `googleId` or existing email; otherwise creates customer like register.
8. **Forgot password:** No DB side effects in current implementation; generic message always returned.

## Scenarios

### Success

- **GIVEN** valid org slug and new email **WHEN** POST `/register` **THEN** **201** and `data` contains `user`, `accessToken`, `refreshToken`.
- **GIVEN** valid credentials **WHEN** POST `/login` **THEN** **200** and tokens + user with `permissions`.
- **GIVEN** valid refresh token **WHEN** POST `/refresh` **THEN** **200** and new token pair.
- **GIVEN** valid Bearer token **WHEN** GET `/me` **THEN** **200** and profile data.
- **GIVEN** valid Bearer and body **WHEN** PATCH `/me` **THEN** **200** and updated user subset.
- **GIVEN** valid Bearer and `{ "confirm": "DELETE" }` **WHEN** DELETE `/me` **THEN** **200** and success message.
- **GIVEN** caller with `USER_MANAGEMENT` read **WHEN** GET `/users?search=foo` **THEN** **200** and user array (max 20).

### Failure

- **GIVEN** register/login/google without org slug **WHEN** request **THEN** **400** and slug required message.
- **GIVEN** wrong password **WHEN** POST `/login` **THEN** **400** “Invalid credentials”.
- **GIVEN** invalid refresh token **WHEN** POST `/refresh` **THEN** **401**.
- **GIVEN** no/invalid Bearer **WHEN** GET `/me` **THEN** **401** (middleware) or handler **401**.
- **GIVEN** Bearer but wrong confirm **WHEN** DELETE `/me` **THEN** **400**.
- **GIVEN** no permission **WHEN** GET `/users` **THEN** **403** “Forbidden: insufficient permissions”.
- **GIVEN** no Bearer **WHEN** GET `/users` **THEN** **401**.
- **GIVEN** duplicate email for the organization **WHEN** POST `/register` **THEN** **500** (service throws `Email already in use`; handler does not catch as **400**/**409** — known gap).

### HTTP status coverage (POST `/register`)

| Code | Applies |
|------|---------|
| **200** | N/A — register returns **201** on success. |
| **201** | Success: new customer registered. |
| **400** | Missing org slug; validation errors (Zod). |
| **401** | N/A — register is unauthenticated. |
| **403** | N/A — no RBAC on this route. |
| **404** | N/A — org resolution errors surface as thrown errors / **500**, not **404**. |
| **409** | N/A — duplicate email not mapped to **409** (see **500** scenario above). |
| **500** | Org missing, role missing, duplicate email, or other uncaught service errors. |

### HTTP status coverage (POST `/login`)

| Code | Applies |
|------|---------|
| **200** | Success with tokens + user. |
| **201** | N/A |
| **400** | Missing org slug; invalid credentials; validation errors. |
| **401** | N/A — failed login uses **400** “Invalid credentials”. |
| **403** | N/A |
| **404** | N/A |
| **409** | N/A |
| **500** | Social-only account (`passwordHash` missing) or uncaught errors. |

### HTTP status coverage (POST `/refresh`)

| Code | Applies |
|------|---------|
| **200** | New access + refresh tokens. |
| **400** | N/A — invalid token uses **401**. |
| **401** | Invalid or expired refresh token. |
| **403** | N/A |
| **404** | N/A |
| **409** | N/A |
| **500** | Uncaught errors. |

### HTTP status coverage (GET `/me`)

| Code | Applies |
|------|---------|
| **200** | Profile returned. |
| **400** | N/A |
| **401** | Missing JWT; user id missing; user not found in DB. |
| **403** | Missing `organizationId` on token (org scope middleware). |
| **404** | N/A — missing user returns **401** “User not found”. |
| **409** | N/A |
| **500** | Uncaught errors. |

### HTTP status coverage (POST `/google`)

| Code | Applies |
|------|---------|
| **200** | Login/register success; same token envelope as login. |
| **400** | Missing org slug; invalid token shape; missing email; caught service errors. |
| **401** | N/A — handler maps failures to **400**. |
| **403** | N/A |
| **404** | N/A |
| **409** | N/A |
| **500** | Uncaught errors outside try/catch. |

## Edge Cases

- **JWT `scope` for register:** Access token is issued with `scope: "CUSTOMER"` and `branchId: null` regardless of role (register is customer-only).
- **Service throws** (e.g. org not found, email in use): not translated to **400** in handlers; may surface as **500** via global `onError`.
- **Google auth:** Token is verified via `google-auth-library` JWKS. Invalid signature, expired token, wrong audience, or missing email all return **400** from handler catch. When `GOOGLE_CLIENT_ID` env var is absent, **400** "Google auth not configured" is returned.
- **`getUserById`:** Returns user without merging permissions when `tenantRoleId` is null (early return).

## RBAC

| Endpoint | Requirement |
|----------|-------------|
| `/register`, `/login`, `/refresh`, `/forgot-password`, `/google` | None |
| `/me` (GET/PATCH/DELETE) | Valid JWT; `orgScopeMiddleware` requires `organizationId` on token (**403** if missing org context) |
| `/users` | `USER_MANAGEMENT` **read** |

### PATCH `/me/notification-preferences`

**Request** (`application/json`):

```json
{
  "pushOptOut": "boolean (optional)",
  "whatsappOptOut": "boolean (optional)",
  "smsOptOut": "boolean (optional)",
  "emailOptOut": "boolean (optional)"
}
```

**Response** `200` (`application/json`):

```json
{
  "success": true,
  "data": {
    "pushOptOut": "boolean",
    "whatsappOptOut": "boolean",
    "smsOptOut": "boolean",
    "emailOptOut": "boolean"
  }
}
```

**Business rules:** 
1. Any authenticated user can toggle their own notification preferences. 
2. **Default Behavior**: When a new user is registered (via email registration, Google Auth, or walk-in guest creation), a `NotificationPreference` record is automatically created with **`emailOptOut: false`** by default.
3. **Legacy Migration**: Users without a `NotificationPreference` record are treated as **opted-in** (emails will be sent) to ensure backward compatibility for old accounts.
4. No RBAC permission required beyond a valid JWT.

**HTTP status coverage:**

| Code | Applies |
|------|---------|
| **200** | Preference updated. |
| **400** | Validation error (invalid body). |
| **401** | Missing/invalid JWT. |
| **403** | Missing `organizationId` on token (org scope middleware). |

## Dependencies

- **Prisma:** `organization`, `tenantRole`, `user`, `customerMembership`, `refreshToken`, `tenantRolePermission`, `auditLog`.
- **Libraries:** `bcryptjs`, `hono/jwt` (`sign` / `verify`), `google-auth-library` (`OAuth2Client.verifyIdToken` for Google JWKS verification).
- **Middleware:** `authMiddleware`, `orgScopeMiddleware`, `requirePermission` on `/users`.
