import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { CashDrawerService } from "./cash-drawer.service";
import {
  openSessionSchema,
  closeSessionSchema,
  addEntrySchema,
  currentSessionQuerySchema,
} from "./cash-drawer.schema";
import { createSuccessSchema, ErrorSchema } from "../../utils/openapi";
import {
  CashDrawerStatusEnum,
  CashEntryTypeEnum,
  BranchSummarySchema,
  UserSummarySchema,
} from "../../utils/zod-prisma";

// -----------------------------------------------------------------------------
// Response schemas
// -----------------------------------------------------------------------------

const CashDrawerEntrySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  type: CashEntryTypeEnum,
  amount: z.number(),
  reference: z.string().nullable(),
  createdAt: z.string(),
});

const CashDrawerSessionSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  openedById: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number().nullable(),
  expectedBalance: z.number().nullable(),
  discrepancy: z.number().nullable(),
  status: CashDrawerStatusEnum,
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  notes: z.string().nullable(),
  branch: BranchSummarySchema.optional(),
  openedBy: UserSummarySchema.optional(),
  entries: z.array(CashDrawerEntrySchema).optional(),
});

const SessionSuccessSchema = createSuccessSchema(
  CashDrawerSessionSchema.nullable()
);
const EntrySuccessSchema = createSuccessSchema(CashDrawerEntrySchema);

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

export const openSessionRoute = createRoute({
  method: "post",
  path: "/open",
  tags: ["Cash Drawer"],
  summary: "Open a cash drawer session",
  description: "Creates a new OPEN session. Fails if one is already open for the branch.",
  request: {
    body: {
      content: { "application/json": { schema: openSessionSchema } },
    },
  },
  responses: {
    201: {
      description: "Session opened successfully",
      content: {
        "application/json": {
          schema: SessionSuccessSchema,
        },
      },
    },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

export const getCurrentSessionRoute = createRoute({
  method: "get",
  path: "/current",
  tags: ["Cash Drawer"],
  summary: "Get current session for branch",
  description: "Returns the OPEN session with entries, or null if none.",
  request: {
    query: currentSessionQuerySchema,
  },
  responses: {
    200: {
      description: "Current session or null",
      content: {
        "application/json": {
          schema: SessionSuccessSchema,
        },
      },
    },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

export const closeSessionRoute = createRoute({
  method: "post",
  path: "/close",
  tags: ["Cash Drawer"],
  summary: "Close a cash drawer session",
  description: "Computes expected balance, discrepancy, and marks session CLOSED.",
  request: {
    body: {
      content: { "application/json": { schema: closeSessionSchema } },
    },
  },
  responses: {
    200: {
      description: "Session closed successfully",
      content: {
        "application/json": {
          schema: SessionSuccessSchema,
        },
      },
    },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Session not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

export const addEntryRoute = createRoute({
  method: "post",
  path: "/entry",
  tags: ["Cash Drawer"],
  summary: "Add a manual cash entry",
  description: "Adds SALE, REFUND, ADJUSTMENT, or FLOAT entry to an open session.",
  request: {
    body: {
      content: { "application/json": { schema: addEntrySchema } },
    },
  },
  responses: {
    201: {
      description: "Entry added successfully",
      content: {
        "application/json": {
          schema: EntrySuccessSchema,
        },
      },
    },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Session not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

// -----------------------------------------------------------------------------
// HANDLERS
// -----------------------------------------------------------------------------

export const openSessionHandler: RouteHandler<typeof openSessionRoute, AppEnv> = async (c) => {
  try {
    const { branchId, openingBalance } = c.req.valid("json");
    const userId = c.var.userId!;
    const result = await CashDrawerService.openSession(
      c.var.db,
      branchId,
      userId,
      c.get("organizationId")!,
      openingBalance
    );
    return c.json({ success: true, data: result }, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (msg.includes("already open")) {
      return c.json({ success: false, message: msg }, 400);
    }
    console.error("Failed to open cash drawer session:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const getCurrentSessionHandler: RouteHandler<typeof getCurrentSessionRoute, AppEnv> = async (c) => {
  try {
    const { branchId } = c.req.valid("query");
    const result = await CashDrawerService.getCurrentSession(c.var.db, branchId);
    return c.json({ success: true, data: result }, 200);
  } catch (error: unknown) {
    console.error("Failed to get current session:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const closeSessionHandler: RouteHandler<typeof closeSessionRoute, AppEnv> = async (c) => {
  try {
    const { sessionId, closingBalance, notes } = c.req.valid("json");
    const result = await CashDrawerService.closeSession(
      c.var.db,
      sessionId,
      closingBalance,
      notes
    );
    return c.json({ success: true, data: result }, 200);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    if (msg.includes("already closed")) {
      return c.json({ success: false, message: msg }, 400);
    }
    console.error("Failed to close cash drawer session:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const addEntryHandler: RouteHandler<typeof addEntryRoute, AppEnv> = async (c) => {
  try {
    const { sessionId, type, amount, reference } = c.req.valid("json");
    const result = await CashDrawerService.addEntry(
      c.var.db,
      sessionId,
      type,
      amount,
      reference
    );
    return c.json({ success: true, data: result }, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (msg.includes("not found")) return c.json({ success: false, message: msg }, 404);
    if (msg.includes("closed")) return c.json({ success: false, message: msg }, 400);
    console.error("Failed to add cash drawer entry:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};
