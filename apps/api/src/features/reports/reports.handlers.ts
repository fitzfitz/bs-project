import { createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import type { RouteHandler } from "@hono/zod-openapi";
import { ReportsService } from "./reports.service";
import { generateReportQuery, exportCsvQuery } from "./reports.schema";

const jsonRes = z.object({ success: z.boolean(), data: z.any() });

export const generateReportRoute = createRoute({
  method: "get",
  path: "/generate",
  request: { query: generateReportQuery },
  responses: { 200: { description: "Generated report data", content: { "application/json": { schema: jsonRes } } } },
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
  const csv = ReportsService.exportCSV(report);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${report.type}_${query.dateFrom}_${query.dateTo}.csv"`,
    },
  });
};
