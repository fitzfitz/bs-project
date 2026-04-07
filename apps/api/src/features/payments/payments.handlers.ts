import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { TransactionService } from "../transactions/transactions.service";
import { xenditWebhookBodySchema, createChargeSchema, savePaymentMethodSchema, paymentMethodIdParam } from "./payments.schema";
import { createXenditInvoice } from "../../utils/xendit-adapter";
import { createSuccessSchema, ErrorSchema } from "../../utils/openapi";
import { createNotificationService } from "../../utils/notifications";

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
    400: { description: "Invalid JSON or payload" },
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
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ success: false, message: "Invalid JSON" }, 400);
  }
  const parsed = xenditWebhookBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, message: "Invalid webhook payload" }, 400);
  }
  const body = parsed.data;
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
    const ns = createNotificationService(c.env, db);
    await TransactionService.finalizeTransactionOnPaid(db, payment.transactionId, ns);
  } catch (err) {
    console.error("Webhook finalize transaction:", err);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
  return c.json({ success: true }, 200);
};

// ============================================================================
// Create Charge
// ============================================================================

export const createChargeRoute = createRoute({
  method: "post",
  path: "/create-charge",
  tags: ["Payments"],
  summary: "Create Xendit invoice for a pending transaction",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createChargeSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createSuccessSchema(
            z.object({
              invoiceId: z.string(),
              invoiceUrl: z.string(),
            })
          ),
        },
      },
      description: "Xendit invoice created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Bad request",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Transaction not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Payment gateway error",
    },
  },
});

export const createChargeHandler: RouteHandler<typeof createChargeRoute, AppEnv> = async (c) => {
  const { transactionId, successRedirectUrl, failureRedirectUrl } = c.req.valid("json");
  const secretKey = c.env.XENDIT_SECRET_KEY;

  if (!secretKey) {
    return c.json({ success: false as const, message: "Payment gateway not configured" }, 400);
  }

  const db = c.var.db;
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, status: true, totalDue: true, organizationId: true, customerId: true },
  });

  if (!transaction) {
    return c.json({ success: false as const, message: "Transaction not found" }, 404);
  }

  if (transaction.status !== "PENDING") {
    return c.json({ success: false as const, message: "Transaction is not in PENDING status" }, 400);
  }

  // Identity Handover: If the transaction has no customer ID (e.g. POS Walk-in), 
  // link it to the authenticated user who is initiating this payment.
  const authenticatedUserId = c.get("userId");
  if (!transaction.customerId && authenticatedUserId) {
    await db.transaction.update({
      where: { id: transactionId },
      data: { customerId: authenticatedUserId },
    });
  }

  try {
    const invoice = await createXenditInvoice({
      secretKey,
      externalId: transactionId,
      amount: transaction.totalDue,
      successRedirectUrl,
      failureRedirectUrl,
    });

    await db.payment.create({
      data: {
        transactionId,
        organizationId: transaction.organizationId,
        method: "CARD",
        amount: transaction.totalDue,
        reference: invoice.id,
      },
    });

    return c.json(
      {
        success: true as const,
        data: {
          invoiceId: invoice.id,
          invoiceUrl: invoice.invoice_url,
        },
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment gateway error";
    console.error("Create charge error:", message);
    return c.json({ success: false as const, message: "Payment gateway error" }, 500);
  }
};

// ============================================================================
// Saved Payment Methods
// ============================================================================

const PaymentMethodItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  last4: z.string(),
  expiryMonth: z.number(),
  expiryYear: z.number(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});

export const listMethodsRoute = createRoute({
  method: "get",
  path: "/methods",
  tags: ["Payment Methods"],
  summary: "List saved payment methods",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(PaymentMethodItemSchema)),
        },
      },
      description: "Saved payment methods",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const listMethodsHandler: RouteHandler<typeof listMethodsRoute, AppEnv> = async (c) => {
  const userId = c.get("userId") as string;
  const methods = await c.var.db.savedPaymentMethod.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ success: true as const, data: methods }, 200);
};

export const saveMethodRoute = createRoute({
  method: "post",
  path: "/methods",
  tags: ["Payment Methods"],
  summary: "Save a new tokenized payment method",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: savePaymentMethodSchema } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createSuccessSchema(PaymentMethodItemSchema),
        },
      },
      description: "Payment method saved",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Maximum methods reached",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
});

export const saveMethodHandler: RouteHandler<typeof saveMethodRoute, AppEnv> = async (c) => {
  const userId = c.get("userId") as string;
  const organizationId = c.get("organizationId")!;
  const data = c.req.valid("json");
  const db = c.var.db;

  const count = await db.savedPaymentMethod.count({ where: { userId } });
  if (count >= 5) {
    return c.json({ success: false as const, message: "Maximum payment methods reached (5)" }, 400);
  }

  if (data.isDefault) {
    await db.savedPaymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const method = await db.savedPaymentMethod.create({
    data: {
      organizationId,
      userId,
      tokenId: data.tokenId,
      type: data.type,
      last4: data.last4,
      expiryMonth: data.expiryMonth,
      expiryYear: data.expiryYear,
      isDefault: data.isDefault,
    },
  });

  return c.json({ success: true as const, data: method }, 201);
};

export const deleteMethodRoute = createRoute({
  method: "delete",
  path: "/methods/{id}",
  tags: ["Payment Methods"],
  summary: "Delete a saved payment method",
  security: [{ bearerAuth: [] }],
  request: { params: paymentMethodIdParam },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessSchema(z.object({ id: z.string() })),
        },
      },
      description: "Payment method deleted",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not found",
    },
  },
});

export const deleteMethodHandler: RouteHandler<typeof deleteMethodRoute, AppEnv> = async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  const db = c.var.db;

  const method = await db.savedPaymentMethod.findFirst({
    where: { id, userId },
  });

  if (!method) {
    return c.json({ success: false as const, message: "Payment method not found" }, 404);
  }

  await db.savedPaymentMethod.delete({ where: { id } });

  return c.json({ success: true as const, data: { id } }, 200);
};
