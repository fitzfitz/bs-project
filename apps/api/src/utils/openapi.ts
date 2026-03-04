import { z } from "@hono/zod-openapi";

export const ErrorSchema = z.object({
  success: z.literal(false).openapi({ example: false }),
  message: z.string().openapi({ example: "An error occurred" }),
});

export function createSuccessSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    success: z.literal(true).openapi({ example: true }),
    data: schema,
  });
}

export const MessageSuccessSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string().optional().openapi({ example: "Operation successful" }),
});

export const PaginationSchema = z.object({
  page: z.number().int().openapi({ example: 1 }),
  limit: z.number().int().openapi({ example: 20 }),
  total: z.number().int().openapi({ example: 100 }),
  totalPages: z.number().int().openapi({ example: 5 }),
});

export function createPaginatedSuccessSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    success: z.literal(true).openapi({ example: true }),
    data: z.array(schema),
    pagination: PaginationSchema,
  });
}
