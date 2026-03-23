import { z } from "zod";

export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  industry: z.enum([
    "BARBERSHOP", "VET_CLINIC", "MASSAGE", "NAIL_SALON", "SPA",
    "PET_GROOMING", "DENTAL_CLINIC", "AUTO_DETAILING", "BEAUTY_SALON",
    "TATTOO_PARLOR", "GENERAL_SERVICE",
  ]),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().min(1),
  ownerPassword: z.string().min(8),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  taxName: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const platformConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
