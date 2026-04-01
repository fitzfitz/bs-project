# API Feature: Health (`/api/health`)

## Overview

Lightweight liveness endpoint that confirms the API process is running. No authentication, database, or tenant context.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Returns success flag, static message, and current timestamp (ISO-8601). |

Mounted at application base path `/api/health`, so the full path is `/api/health/` (or `/api/health` depending on server trailing-slash behavior).

## Business Rules

- Always returns **200** with JSON body when the route is hit.
- Timestamp is generated at request time (`new Date().toISOString()`).

## Scenarios

### Success

- **GIVEN** the API is up **WHEN** GET `/api/health/` **THEN** **200**, `success: true`, `message` describes the API, `timestamp` is a non-empty ISO string.

### Failure

- **GIVEN** wrong method or path **WHEN** request **THEN** **404** from app `notFound` (not this feature’s handler).

## Edge Cases

- No OpenAPI/Zod schemas in this module (plain `Hono` route).
- Not suitable as a deep health check (no DB/connectivity validation).

## RBAC

None.

## Dependencies

None (no Prisma or external services in this handler).
