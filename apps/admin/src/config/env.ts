import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.string().url().optional(),
  VITE_ORG_SLUG: z.string().optional(),
});

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL ?? "http://localhost:8787/api",
  VITE_ORG_SLUG: import.meta.env.VITE_ORG_SLUG ?? "budis-barbershop",
});

export type Env = z.infer<typeof envSchema>;
