import { z } from "zod";

/** Xendit webhook callback body (subset we use). */
export const xenditWebhookBodySchema = z.object({
  id: z.string(),
  external_id: z.string(),
  status: z.string(),
});

export type XenditWebhookBody = z.infer<typeof xenditWebhookBodySchema>;
