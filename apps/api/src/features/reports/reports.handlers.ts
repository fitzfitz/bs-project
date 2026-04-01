import { createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";
import { createSuccessSchema, ErrorSchema, MessageSuccessSchema } from "../../utils/openapi";
import { ReportsService } from "./reports.service";
import {
  generateReportQuery,
  exportCsvQuery,
  exportPdfQuery,
  ReportDataResponseSchema,
  createScheduleBody,
  updateScheduleBody,
  scheduleIdParam,
  createTemplateBody,
  templateIdParam,
  ReportScheduleResponseSchema,
  SavedReportTemplateResponseSchema,
} from "./reports.schema";

export const generateReportRoute = createRoute({
  method: "get",
  path: "/generate",
  request: { query: generateReportQuery },
  responses: {
    200: {
      description: "Generated report data",
      content: { "application/json": { schema: createSuccessSchema(ReportDataResponseSchema) } },
    },
  },
  tags: ["Reports"],
});

export const generateReportHandler: RouteHandler<typeof generateReportRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const data = await ReportsService.generateReport(c.var.db, query);
  return c.json({ success: true, data }, 200);
};

export const exportCsvRoute = createRoute({
  method: "get",
  path: "/export/csv",
  request: { query: exportCsvQuery },
  responses: { 200: { description: "CSV file" } },
  tags: ["Reports"],
});

export const exportCsvHandler: RouteHandler<typeof exportCsvRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const report = await ReportsService.generateReport(c.var.db, query);
  const orgId = c.get("organizationId");
  const org = orgId ? await c.var.db.organization.findUnique({ where: { id: orgId }, select: { currency: true, locale: true } }) : null;
  const csv = ReportsService.exportCSV(report, org?.currency, org?.locale);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${report.type}_${query.dateFrom}_${query.dateTo}.csv"`,
    },
  });
};

export const exportPdfRoute = createRoute({
  method: "get",
  path: "/export/pdf",
  request: { query: exportPdfQuery },
  responses: { 200: { description: "PDF file" } },
  tags: ["Reports"],
});

export const exportPdfHandler: RouteHandler<typeof exportPdfRoute, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const report = await ReportsService.generateReport(c.var.db, query);
  const orgId = c.get("organizationId");
  const org = orgId ? await c.var.db.organization.findUnique({ where: { id: orgId }, select: { currency: true, locale: true } }) : null;
  const pdf = await ReportsService.exportPDF(report, {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  }, org?.currency, org?.locale);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.type}_${query.dateFrom}_${query.dateTo}.pdf"`,
    },
  });
};

export const listSchedulesRoute = createRoute({
  method: "get",
  path: "/schedules",
  responses: {
    200: {
      description: "Report schedules",
      content: {
        "application/json": { schema: createSuccessSchema(z.array(ReportScheduleResponseSchema)) },
      },
    },
  },
  tags: ["Reports"],
});

export const listSchedulesHandler: RouteHandler<typeof listSchedulesRoute, AppEnv> = async (c) => {
  const orgId = c.var.organizationId!;
  const rows = await ReportsService.listSchedules(c.var.db, orgId);
  const data = rows.map((s) => ({
    id: s.id,
    organizationId: s.organizationId,
    branchId: s.branchId,
    reportType: s.reportType,
    frequency: s.frequency,
    recipients: s.recipients,
    filters: (s.filters as Record<string, unknown>) ?? {},
    isActive: s.isActive,
    lastSentAt: s.lastSentAt?.toISOString() ?? null,
    nextRunAt: s.nextRunAt.toISOString(),
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
  return c.json({ success: true, data }, 200);
};

export const createScheduleRoute = createRoute({
  method: "post",
  path: "/schedules",
  request: { body: { content: { "application/json": { schema: createScheduleBody } } } },
  responses: {
    201: {
      description: "Created",
      content: {
        "application/json": { schema: createSuccessSchema(ReportScheduleResponseSchema) },
      },
    },
  },
  tags: ["Reports"],
});

export const createScheduleHandler: RouteHandler<typeof createScheduleRoute, AppEnv> = async (c) => {
  const body = c.req.valid("json");
  const orgId = c.var.organizationId!;
  const userId = c.var.userId!;
  const row = await ReportsService.createSchedule(c.var.db, orgId, userId, {
    reportType: body.reportType,
    branchId: body.branchId,
    frequency: body.frequency,
    recipients: body.recipients,
    filters: body.filters,
  });
  const data = {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    reportType: row.reportType,
    frequency: row.frequency,
    recipients: row.recipients,
    filters: (row.filters as Record<string, unknown>) ?? {},
    isActive: row.isActive,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt.toISOString(),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  return c.json({ success: true, data }, 201);
};

export const updateScheduleRoute = createRoute({
  method: "patch",
  path: "/schedules/{id}",
  request: {
    params: scheduleIdParam,
    body: { content: { "application/json": { schema: updateScheduleBody } } },
  },
  responses: {
    200: {
      description: "Updated",
      content: {
        "application/json": { schema: createSuccessSchema(ReportScheduleResponseSchema) },
      },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
  tags: ["Reports"],
});

export const updateScheduleHandler: RouteHandler<typeof updateScheduleRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const orgId = c.var.organizationId!;
  try {
    const row = await ReportsService.updateSchedule(c.var.db, orgId, id, body);
    const data = {
      id: row.id,
      organizationId: row.organizationId,
      branchId: row.branchId,
      reportType: row.reportType,
      frequency: row.frequency,
      recipients: row.recipients,
      filters: (row.filters as Record<string, unknown>) ?? {},
      isActive: row.isActive,
      lastSentAt: row.lastSentAt?.toISOString() ?? null,
      nextRunAt: row.nextRunAt.toISOString(),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    return c.json({ success: true, data }, 200);
  } catch (e) {
    if (e instanceof Error && e.message === "Schedule not found") {
      return c.json({ success: false, message: e.message }, 404);
    }
    throw e;
  }
};

export const deleteScheduleRoute = createRoute({
  method: "delete",
  path: "/schedules/{id}",
  request: { params: scheduleIdParam },
  responses: {
    200: {
      description: "Deleted",
      content: { "application/json": { schema: MessageSuccessSchema } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
  tags: ["Reports"],
});

export const deleteScheduleHandler: RouteHandler<typeof deleteScheduleRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const orgId = c.var.organizationId!;
  try {
    await ReportsService.deleteSchedule(c.var.db, orgId, id);
    return c.json({ success: true, message: "Schedule deleted" }, 200);
  } catch (e) {
    if (e instanceof Error && e.message === "Schedule not found") {
      return c.json({ success: false, message: e.message }, 404);
    }
    throw e;
  }
};

export const listTemplatesRoute = createRoute({
  method: "get",
  path: "/templates",
  responses: {
    200: {
      description: "Saved report templates",
      content: {
        "application/json": {
          schema: createSuccessSchema(z.array(SavedReportTemplateResponseSchema)),
        },
      },
    },
  },
  tags: ["Reports"],
});

export const listTemplatesHandler: RouteHandler<typeof listTemplatesRoute, AppEnv> = async (c) => {
  const orgId = c.var.organizationId!;
  const rows = await ReportsService.listTemplates(c.var.db, orgId);
  const data = rows.map((t) => ({
    id: t.id,
    organizationId: t.organizationId,
    name: t.name,
    reportType: t.reportType,
    filters: (t.filters as Record<string, unknown>) ?? {},
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
  return c.json({ success: true, data }, 200);
};

export const createTemplateRoute = createRoute({
  method: "post",
  path: "/templates",
  request: { body: { content: { "application/json": { schema: createTemplateBody } } } },
  responses: {
    201: {
      description: "Created",
      content: {
        "application/json": { schema: createSuccessSchema(SavedReportTemplateResponseSchema) },
      },
    },
  },
  tags: ["Reports"],
});

export const createTemplateHandler: RouteHandler<typeof createTemplateRoute, AppEnv> = async (c) => {
  const body = c.req.valid("json");
  const orgId = c.var.organizationId!;
  const userId = c.var.userId!;
  const row = await ReportsService.createTemplate(c.var.db, orgId, userId, {
    name: body.name,
    reportType: body.reportType,
    filters: body.filters,
  });
  const data = {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    reportType: row.reportType,
    filters: (row.filters as Record<string, unknown>) ?? {},
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  return c.json({ success: true, data }, 201);
};

export const deleteTemplateRoute = createRoute({
  method: "delete",
  path: "/templates/{id}",
  request: { params: templateIdParam },
  responses: {
    200: {
      description: "Deleted",
      content: { "application/json": { schema: MessageSuccessSchema } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
  tags: ["Reports"],
});

export const deleteTemplateHandler: RouteHandler<typeof deleteTemplateRoute, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const orgId = c.var.organizationId!;
  try {
    await ReportsService.deleteTemplate(c.var.db, orgId, id);
    return c.json({ success: true, message: "Template deleted" }, 200);
  } catch (e) {
    if (e instanceof Error && e.message === "Template not found") {
      return c.json({ success: false, message: e.message }, 404);
    }
    throw e;
  }
};
