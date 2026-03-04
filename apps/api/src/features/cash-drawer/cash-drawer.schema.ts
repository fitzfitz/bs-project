import { z } from "@hono/zod-openapi";

export const CashEntryTypeEnum = z.enum(["SALE", "REFUND", "ADJUSTMENT", "FLOAT"]);

export const openSessionSchema = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
  openingBalance: z.number().min(0, "Opening balance cannot be negative"),
});

export const closeSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  closingBalance: z.number().min(0, "Closing balance cannot be negative"),
  notes: z.string().optional(),
});

export const addEntrySchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  type: CashEntryTypeEnum,
  amount: z.number(),
  reference: z.string().optional(),
});

export const currentSessionQuerySchema = z.object({
  branchId: z.string().min(1, "Branch ID is required"),
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type AddEntryInput = z.infer<typeof addEntrySchema>;
export type CurrentSessionQuery = z.infer<typeof currentSessionQuerySchema>;
