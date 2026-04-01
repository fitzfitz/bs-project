# API: Media

## Overview

Authenticated upload of images to S3-compatible storage (MinIO) and delete-by-key. Validates MIME allow-list, size limits, magic bytes vs declared type, and optional `prefix` / `entityId` for object key layout.

## API Endpoints

Base path: `/api/media`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload` | Multipart field `file`; query `prefix` (enum), optional `entityId`. |
| DELETE | `/` | Query `key` (non-empty string). |

## Business Rules

- **Auth**: `authMiddleware` + `orgScopeMiddleware` — requires valid tenant JWT and organization context (`403` if no `organizationId`).
- **Storage**: If `getS3Client` is null or `S3_BUCKET` unset → `503` “Object storage is not configured”.
- **Upload size**: `Content-Length` header > 5 MB → `413`; also rejects if `file.size` > 5 MB after parse.
- **Allowed types**: `image/jpeg`, `image/png`, `image/webp` only (declared MIME must match magic bytes).
- **Key pattern**: `{prefix}/{uuid}.ext` or `{prefix}/{entityId}/{uuid}.ext`.
- **Delete**: Removes object from bucket; no existence check in handler.

## Scenarios

### Success

- **GIVEN** configured S3 env, valid JWT, valid JPEG bytes **WHEN** POST `/upload?prefix=avatars` **THEN** `200`, `{ success: true, data: { url, key } }`.
- **GIVEN** configured S3 **WHEN** DELETE `/?key=avatars/foo.jpg` **THEN** `200`, `{ success: true, message: "File deleted" }`.

### Failure

- **GIVEN** no `Authorization` **WHEN** POST or DELETE **THEN** `401`.
- **GIVEN** valid JWT but no org context **WHEN** POST **THEN** `403` from org scope.
- **GIVEN** storage not configured **WHEN** POST **THEN** `503`.
- **GIVEN** missing `file` field **WHEN** POST **THEN** `400`.
- **GIVEN** wrong magic bytes **WHEN** POST **THEN** `400` content/MIME mismatch.

## Edge Cases

- `image/gif` appears in magic-byte table in code but is **not** in `ALLOWED_MIME_TYPES`, so GIF uploads fail at MIME check.
- `Content-Length` 0 with valid body still parses; relies on parsed `File` size.

## RBAC

- **No `requirePermission`** — any authenticated staff/user in org context may call media routes.

## Dependencies

- **Env**: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, optional `S3_PUBLIC_URL`
- **Utils**: `getS3Client`, `uploadFile`, `deleteFile`, `buildPublicUrl`
