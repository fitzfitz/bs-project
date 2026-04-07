import { createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { TransactionService } from "./transactions.service";
import { createNotificationService } from "../../utils/notifications";
import {
  createTransactionSchema,
  addPaymentsSchema,
  voidTransactionSchema,
  refundTransactionSchema,
  listTransactionsQuerySchema,
  createTransaction201Schema,
  addPayments200Schema,
  voidTransaction200Schema,
  refundTransaction200Schema,
  listTransactions200Schema,
  getDailySummary200Schema,
  getTransactionById200Schema,
  getReceipt200Schema,
} from "./transactions.schema";
import { getPermissionsFromCache } from "../../middlewares/rbac";

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

export const createTransactionRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Transactions"],
  summary: "Create a new draft transaction",
  description: "Creates a PENDING transaction.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createTransactionSchema } },
    },
  },
  responses: {
    201: {
      description: "Transaction created successfully",
      content: {
        "application/json": {
          schema: createTransaction201Schema,
        },
      },
    },
    400: { description: "Bad request" },
    409: { description: "Conflict (duplicate clientUuid)" },
    500: { description: "Internal server error" },
  },
});

export const addPaymentsRoute = createRoute({
  method: "post",
  path: "/{id}/pay",
  tags: ["Transactions"],
  summary: "Add payments and complete transaction",
  description: "Records payments and marks the transaction as COMPLETED.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: addPaymentsSchema } },
    },
  },
  responses: {
    200: {
      description: "Payments recorded and transaction completed",
      content: {
        "application/json": {
          schema: addPayments200Schema,
        },
      },
    },
    400: { description: "Payment total mismatch or invalid status" },
    404: { description: "Transaction not found" },
    500: { description: "Internal server error" },
  },
});

export const voidRoute = createRoute({
  method: "post",
  path: "/{id}/void",
  tags: ["Transactions"],
  summary: "Void a transaction",
  description: "Voids a transaction and logs an audit record.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: voidTransactionSchema } },
    },
  },
  responses: {
    200: {
      description: "Transaction voided",
      content: {
        "application/json": {
          schema: voidTransaction200Schema,
        },
      },
    },
    400: { description: "Transaction already voided" },
    404: { description: "Transaction not found" },
    500: { description: "Internal server error" },
  },
});

export const refundRoute = createRoute({
  method: "post",
  path: "/{id}/refund",
  tags: ["Transactions"],
  summary: "Refund a transaction",
  description: "Refunds a completed transaction, reversing inventory and loyalty points.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: refundTransactionSchema } },
    },
  },
  responses: {
    200: {
      description: "Transaction refunded",
      content: {
        "application/json": {
          schema: refundTransaction200Schema,
        },
      },
    },
    400: { description: "Transaction cannot be refunded" },
    404: { description: "Transaction not found" },
    500: { description: "Internal server error" },
  },
});

export const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Transactions"],
  summary: "List transactions",
  description: "Retrieve a paginated list of transactions.",
  security: [{ bearerAuth: [] }],
  request: {
    query: listTransactionsQuerySchema,
  },
  responses: {
    200: {
      description: "List of transactions",
      content: {
        "application/json": {
          schema: listTransactions200Schema,
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const getSummaryRoute = createRoute({
  method: "get",
  path: "/summary",
  tags: ["Transactions"],
  summary: "Get daily summary",
  description: "Retrieve a summary of transactions for a specific branch and date.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      branchId: z.string().min(1),
      date: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Daily summary",
      content: {
        "application/json": {
          schema: getDailySummary200Schema,
        },
      },
    },
    500: { description: "Internal server error" },
  },
});

export const getByIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Transactions"],
  summary: "Get transaction by ID",
  description: "Retrieve complete details for a specific transaction by its ID.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Transaction details",
      content: {
        "application/json": {
          schema: getTransactionById200Schema,
        },
      },
    },
    404: { description: "Transaction not found" },
    500: { description: "Internal server error" },
  },
});

export const getReceiptRoute = createRoute({
  method: "get",
  path: "/{id}/receipt",
  tags: ["Transactions"],
  summary: "Get receipt data",
  description: "Retrieve data formatted for a digital receipt.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Receipt data",
      content: {
        "application/json": {
          schema: getReceipt200Schema,
        },
      },
    },
    404: { description: "Transaction not found" },
    500: { description: "Internal server error" },
  },
});

// -----------------------------------------------------------------------------
// HANDLERS
// -----------------------------------------------------------------------------

export const createHandler: RouteHandler<typeof createTransactionRoute, AppEnv> = async (c) => {
  try {
    const data = c.req.valid("json");
    const organizationId = c.get("organizationId")!;
    const scope = c.get("scope");
    const result = await TransactionService.createTransaction(c.var.db, data, organizationId, scope);
    return c.json({ success: true, message: "Transaction created successfully", data: result }, 201);
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("clientUuid")) {
      return c.json({ success: false, message: "Duplicate client UIID" }, 409);
    }
    console.error("Failed to create transaction:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const addPaymentsHandler: RouteHandler<typeof addPaymentsRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const ns = createNotificationService(c.env, c.var.db);
    const result = await TransactionService.addPayments(c.var.db, id, data, ns);
    return c.json({ success: true, message: "Payments recorded", data: result }, 200);
  } catch (error: any) {
    console.error("Failed to add payments:", error);
    if (error.message.includes("not found")) return c.json({ success: false, message: error.message }, 404);
    if (error.message.includes("mismatch") || error.message.includes("already")) {
      return c.json({ success: false, message: error.message }, 400);
    }
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const voidHandler: RouteHandler<typeof voidRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");
    const userId = c.get("userId")!; 
    const scope = c.get("scope")!;
    
    const result = await TransactionService.voidTransaction(c.var.db, id, userId, scope, reason);
    return c.json({ success: true, message: "Transaction voided", data: result }, 200);
  } catch (error: any) {
    console.error("Failed to void transaction:", error);
    if (error.message.includes("not found")) return c.json({ success: false, message: error.message }, 404);
    if (error.message.includes("already voided")) return c.json({ success: false, message: error.message }, 400);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const refundHandler: RouteHandler<typeof refundRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");
    const userId = c.get("userId")!;

    const result = await TransactionService.refundTransaction(c.var.db, id, userId, reason);
    return c.json({ success: true, message: "Transaction refunded", data: result }, 200);
  } catch (error: any) {
    console.error("Failed to refund transaction:", error);
    if (error.message.includes("not found")) return c.json({ success: false, message: error.message }, 404);
    if (error.message.includes("already refunded") || error.message.includes("Only completed")) {
      return c.json({ success: false, message: error.message }, 400);
    }
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const listHandler: RouteHandler<typeof listRoute, AppEnv> = async (c) => {
  try {
    const query = c.req.valid("query");
    const result = await TransactionService.listTransactions(c.var.db, query);
    return c.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }
    }, 200);
  } catch (error: any) {
    console.error("Failed to list transactions:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getSummaryHandler: RouteHandler<typeof getSummaryRoute, AppEnv> = async (c) => {
  try {
    const { branchId, date } = c.req.valid("query");
    const targetDate = date ? new Date(date) : new Date();
    const result = await TransactionService.getDailySummary(c.var.db, branchId, targetDate);
    return c.json({ success: true, data: result }, 200);
  } catch (error: any) {
    console.error("Failed to get daily summary:", error);
    return c.json({ success: false, message: "Internal server error", error: error.message, stack: error.stack }, 500);
  }
};

export const getByIdHandler: RouteHandler<typeof getByIdRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;
    const tenantRoleId = c.get("tenantRoleId");
    const permissions = tenantRoleId ? await getPermissionsFromCache(c.var.db, tenantRoleId) : undefined;

    const result = await TransactionService.getTransactionById(c.var.db, id, userId, permissions);
    return c.json({ success: true, data: result }, 200);
  } catch (error: any) {
    if (error instanceof HTTPException) {
      return c.json({ success: false, message: error.message }, error.status);
    }
    console.error("Failed to get transaction:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getReceiptHandler: RouteHandler<typeof getReceiptRoute, AppEnv> = async (c) => {
  try {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;
    const tenantRoleId = c.get("tenantRoleId");
    const permissions = tenantRoleId ? await getPermissionsFromCache(c.var.db, tenantRoleId) : undefined;

    const result = await TransactionService.getReceiptData(c.var.db, id, userId, permissions);
    return c.json({ success: true, data: result }, 200);
  } catch (error: unknown) {
    if (error instanceof HTTPException) {
        return c.json({ success: false, message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Failed to get receipt data:", message);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};
