import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { TransactionService } from "../transactions/transactions.service";

export const webhookRoute = createRoute({
  method: "post",
  path: "/webhook",
  tags: ["Payments"],
  summary: "Xendit webhook",
  description:
    "Callback from Xendit when invoice status changes. Verifies X-Callback-Token. On PAID, finalizes the transaction.",
  request: {
    headers: z.object({
      "x-callback-token": z.string().optional(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            external_id: z.string(),
            status: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Accepted" },
    401: { description: "Invalid callback token" },
    500: { description: "Internal server error" },
  },
});

export const webhookHandler: RouteHandler<typeof webhookRoute, AppEnv> = async (c) => {
  const token = c.req.header("x-callback-token");
  const expected = c.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return c.json({ success: false, message: "Invalid callback token" }, 401);
  }
  let body: { id: string; external_id: string; status: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "Invalid JSON" }, 400);
  }
  if (body.status !== "PAID") {
    return c.json({ success: true }, 200);
  }
  const db = c.var.db;
  const payment = await db.payment.findFirst({
    where: { reference: body.id },
    select: { transactionId: true },
  });
  if (!payment) {
    return c.json({ success: true }, 200);
  }
  try {
    await TransactionService.finalizeTransactionOnPaid(db, payment.transactionId);
  } catch (err) {
    console.error("Webhook finalize transaction:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
  return c.json({ success: true }, 200);
};
