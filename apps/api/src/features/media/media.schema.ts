import { z } from "@hono/zod-openapi";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const UPLOAD_PREFIXES = [
  "avatars",
  "staff",
  "branches",
  "products",
  "reviews",
] as const;

export type UploadPrefix = (typeof UPLOAD_PREFIXES)[number];

/**
 * Multipart `file` is a `File` at runtime; OpenAPI documents it as binary (string + format).
 * @hono/zod-openapi still runs body validation, so we accept `File`, not only `string`.
 */
export const uploadMultipartFormSchema = z.object({
  file: z
    .custom<File>((v) => v instanceof File)
    .openapi({ type: "string", format: "binary", description: "File to upload" }),
});

export const uploadResponseSchema = z
  .object({
    url: z.string().url(),
    key: z.string(),
  })
  .openapi("UploadResponse");
