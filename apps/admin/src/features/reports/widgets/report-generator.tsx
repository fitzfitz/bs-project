import { useState } from "react";
import { useReport, useExportCSV, type ReportType } from "../api/use-reports";
import { Download } from "lucide-react";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "daily_revenue", label: "Daily Revenue" },
  { value: "service_popularity", label: "Service Popularity" },
  { value: "staff_leaderboard", label: "Staff Leaderboard" },
  { value: "customer_visits", label: "Customer Visits" },
  { value: "booking_source", label: "Booking Source Analysis" },
];

export function ReportGenerator({ branchId, dateFrom, dateTo }: { branchId: string; dateFrom: string; dateTo: string }) {
  const [type, setType] = useState<ReportType>("daily_revenue");
  const { data, isLoading } = useReport({ type, branchId, dateFrom, dateTo });
  const exportCSV = useExportCSV();
  const report = (data as any)?.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
        >
          {REPORT_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={() => exportCSV.mutate({ type, branchId, dateFrom, dateTo })}
          disabled={exportCSV.isPending || !report}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}</div>
      ) : report ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {(report.columns ?? []).map((col: string) => (
                  <th key={col} className="px-4 py-3 text-left font-medium text-slate-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(report.rows ?? []).map((row: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  {(report.columns ?? []).map((col: string) => (
                    <td key={col} className="px-4 py-3 text-slate-700">
                      {typeof row[col] === "number" ? (row[col] as number).toLocaleString() : String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
              {(report.rows ?? []).length === 0 && (
                <tr><td colSpan={report.columns?.length ?? 1} className="px-4 py-8 text-center text-slate-400">No data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Select a branch and report type to generate.</p>
      )}
    </div>
  );
}
