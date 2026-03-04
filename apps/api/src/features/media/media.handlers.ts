import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { getS3Client, uploadFile, buildPublicUrl } from "../../utils/s3";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  UPLOAD_PREFIXES,
  uploadResponseSchema,
  type UploadPrefix,
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
    default:
      return "bin";
  }
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
      content: { "multipart/form-data": { schema: z.any() } },
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

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || !(file instanceof File)) {
    return c.json(
      { success: false as const, message: "Missing 'file' field" },
      400,
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
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

  const { prefix, entityId } = c.req.valid("query");
  const ext = extFromMime(file.type);
  const fileName = `${randomUUID()}.${ext}`;
  const key = entityId ? `${prefix}/${entityId}/${fileName}` : `${prefix}/${fileName}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  await uploadFile(s3, c.env.S3_BUCKET, key, buffer, file.type);

  const url = buildPublicUrl(c.env, key);
  return c.json({ success: true as const, data: { url, key } }, 200);
};
