import { z } from "@hono/zod-openapi";
import { WaitlistStatusEnum } from "../../utils/zod-prisma";

export const joinWaitlistBody = z.object({
  branchId: z.string().min(1),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  preferredTimeSlot: z.string().min(1),
  serviceIds: z.array(z.string()).min(1),
  staffProfileId: z.string().optional(),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistBody>;

export const waitlistIdParam = z.object({
  id: z.string().min(1),
});

export const adminWaitlistQuery = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
});

const dateWire = z.union([z.string(), z.coerce.date()]);

export const WaitlistEntryResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  branchId: z.string(),
  userId: z.string(),
  customerName: z.string(),
  preferredDate: dateWire,
  preferredTimeSlot: z.string(),
  serviceIds: z.array(z.string()),
  staffProfileId: z.string().nullable().optional(),
  status: WaitlistStatusEnum,
  notifiedAt: dateWire.nullable().optional(),
  expiresAt: dateWire,
  createdAt: dateWire,
});

export const WaitlistEntryAdminSchema = WaitlistEntryResponseSchema.extend({
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      firstName: z.string(),
      lastName: z.string(),
    })
    .optional(),
});
