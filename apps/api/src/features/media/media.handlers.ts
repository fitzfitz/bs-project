import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { getS3Client, uploadFile, deleteFile, buildPublicUrl } from "../../utils/s3";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  UPLOAD_PREFIXES,
  uploadMultipartFormSchema,
  uploadResponseSchema,
} from "./media.schema";
import { randomUUID } from "node:crypto";

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "image/gif": [[0x47, 0x49, 0x46]],
};

function validateMagicBytes(bytes: Uint8Array, claimedMime: string): boolean {
  const signatures = MAGIC_BYTES[claimedMime];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => i < bytes.length && bytes[i] === byte),
  );
}

export const uploadRoute = createRoute({
  method: "post",
  path: "/upload",
  tags: ["Media"],
  summary: "Upload a media file to S3/MinIO",
  request: {
    query: z.object({
      prefix: z.enum(UPLOAD_PREFIXES as unknown as [string, ...string[]]),
      entityId: z.string().optional(),
    }),
    body: {
      content: { "multipart/form-data": { schema: uploadMultipartFormSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "File uploaded",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: uploadResponseSchema,
          }),
        },
      },
    },
    400: { description: "Invalid file" },
    413: { description: "File too large" },
    503: { description: "Storage not configured" },
  },
});

export const uploadHandler: RouteHandler<typeof uploadRoute, AppEnv> = async (
  c,
) => {
  const s3 = getS3Client(c.env);
  if (!s3 || !c.env.S3_BUCKET) {
    return c.json(
      { success: false as const, message: "Object storage is not configured" },
      503,
    );
  }

  const contentLength = parseInt(c.req.header("content-length") ?? "0", 10);
  if (contentLength > MAX_FILE_SIZE) {
    return c.json(
      { success: false as const, message: "File too large" },
      413,
    );
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || !(file instanceof File)) {
    return c.json(
      { success: false as const, message: "Missing 'file' field" },
      400,
    );
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return c.json(
      {
        success: false as const,
        message: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      },
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json(
      { success: false as const, message: "File exceeds 5 MB limit" },
      400,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  if (!validateMagicBytes(buffer, file.type)) {
    return c.json(
      { success: false as const, message: "File content does not match declared MIME type" },
      400,
    );
  }

  const { prefix, entityId } = c.req.valid("query");
  const ext = extFromMime(file.type);
  const fileName = `${randomUUID()}.${ext}`;
  const key = entityId ? `${prefix}/${entityId}/${fileName}` : `${prefix}/${fileName}`;

  await uploadFile(s3, c.env.S3_BUCKET, key, buffer, file.type);

  const url = buildPublicUrl(c.env, key);
  return c.json({ success: true as const, data: { url, key } }, 200);
};

export const deleteRoute = createRoute({
  method: "delete",
  path: "/",
  tags: ["Media"],
  summary: "Delete a media file from S3/MinIO",
  request: {
    query: z.object({
      key: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "File deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), message: z.string() }),
        },
      },
    },
    400: { description: "Missing key" },
    503: { description: "Storage not configured" },
  },
});

export const deleteHandler: RouteHandler<typeof deleteRoute, AppEnv> = async (c) => {
  const s3 = getS3Client(c.env);
  if (!s3 || !c.env.S3_BUCKET) {
    return c.json(
      { success: false as const, message: "Object storage is not configured" },
      503,
    );
  }

  const { key } = c.req.valid("query");
  await deleteFile(s3, c.env.S3_BUCKET, key);
  return c.json({ success: true as const, message: "File deleted" }, 200);
};
