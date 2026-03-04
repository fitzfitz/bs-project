import { useState } from "react";
import { useBranchStore } from "@/store/use-branch-store";
import { useGlobalDashboard } from "../api/use-global-dashboard";
import { useBranchComparison } from "../api/use-branch-comparison";
import { usePeakHeatmap } from "../api/use-peak-heatmap";
import { useRetention } from "../api/use-retention";

const TABS = ["Overview", "Comparison", "Peak Hours", "Retention"] as const;
type Tab = (typeof TABS)[number];

export function AnalyticsDashboard({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const branchId = useBranchStore((s) => s.selectedBranchId);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "Comparison" && <ComparisonTab dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "Peak Hours" && <HeatmapTab branchId={branchId} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "Retention" && <RetentionTab branchId={branchId} />}
    </div>
  );
}

function OverviewTab({ dateFrom, dateTo: _dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useGlobalDashboard(dateFrom);

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}</div>;

  const dashboard = (data as any)?.data;
  if (!dashboard) return <p className="text-sm text-slate-500">No data available.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={`Rp ${(dashboard.totals?.totalRevenue ?? 0).toLocaleString()}`} />
        <StatCard label="Transactions" value={String(dashboard.totals?.totalTransactions ?? 0)} />
        <StatCard label="Active Barbers" value={String(dashboard.totals?.totalActiveBarbers ?? 0)} />
        <StatCard label="Queue Entries" value={String(dashboard.totals?.totalQueueEntries ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(dashboard.branches ?? []).map((b: any) => (
          <div key={b.branchId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{b.branchName}</h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${b.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {b.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-400">Revenue</span><p className="font-medium">Rp {(b.revenue ?? 0).toLocaleString()}</p></div>
              <div><span className="text-slate-400">Transactions</span><p className="font-medium">{b.transactionCount ?? 0}</p></div>
              <div><span className="text-slate-400">Queue</span><p className="font-medium">{b.queueLength ?? 0}</p></div>
              <div><span className="text-slate-400">Rating</span><p className="font-medium">{(b.avgRating ?? 0).toFixed(1)} / 5</p></div>
            </div>
          </div>
        ))}
      </div>

      {(dashboard.alerts ?? []).length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-800">Alerts</h3>
          {dashboard.alerts.map((a: any, i: number) => (
            <div key={i} className={`rounded-lg border p-3 text-sm ${
              a.severity === "CRITICAL" ? "border-red-200 bg-red-50 text-red-700" :
              a.severity === "HIGH" ? "border-orange-200 bg-orange-50 text-orange-700" :
              "border-yellow-200 bg-yellow-50 text-yellow-700"
            }`}>
              <span className="font-medium">{a.branchName}:</span> {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useBranchComparison({ dateFrom, dateTo, metric: "revenue" });
  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const items = (data as any)?.data ?? [];
  if (items.length === 0) return <p className="text-sm text-slate-500">No comparison data.</p>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 font-semibold">Branch Revenue Comparison</h3>
      <div className="space-y-3">
        {items.map((b: any) => (
          <div key={b.branchId} className="flex items-center gap-3">
            <span className="w-32 truncate text-sm font-medium">{b.branchName}</span>
            <div className="flex-1 rounded-full bg-slate-100">
              <div
                className="h-6 rounded-full bg-primary/80"
                style={{ width: `${Math.min(100, (b.total / Math.max(...items.map((x: any) => x.total || 1))) * 100)}%` }}
              />
            </div>
            <span className="w-28 text-right text-sm font-medium">Rp {(b.total ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapTab({ branchId, dateFrom, dateTo }: { branchId?: string | null; dateFrom: string; dateTo: string }) {
  const { data, isLoading } = usePeakHeatmap({ branchId: branchId ?? undefined, dateFrom, dateTo });
  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const heatmap = (data as any)?.data?.heatmap;
  if (!heatmap) return <p className="text-sm text-slate-500">No heatmap data.</p>;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxVal = Math.max(...heatmap.flat(), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <h3 className="mb-4 font-semibold">Peak Hour Heatmap</h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {Array.from({ length: 24 }, (_, h) => <th key={h} className="p-1 text-slate-400">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((day, di) => (
            <tr key={day}>
              <td className="pr-2 text-right font-medium text-slate-500">{day}</td>
              {Array.from({ length: 24 }, (_, h) => {
                const val = heatmap[di]?.[h] ?? 0;
                const intensity = val / maxVal;
                return (
                  <td key={h} className="p-0.5">
                    <div
                      className="h-6 w-full rounded-sm"
                      style={{ backgroundColor: `rgba(181, 114, 49, ${Math.max(0.05, intensity)})` }}
                      title={`${day} ${h}:00 — ${val} transactions`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetentionTab({ branchId }: { branchId?: string | null }) {
  const cohortMonth = new Date().toISOString().slice(0, 7);
  const { data, isLoading } = useRetention({ branchId: branchId ?? undefined, cohortMonth });
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  const retention = (data as any)?.data;
  if (!retention) return <p className="text-sm text-slate-500">No retention data.</p>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 font-semibold">Customer Retention (Cohort: {cohortMonth})</h3>
      <p className="mb-4 text-sm text-slate-500">Cohort size: {retention.cohortSize} customers</p>
      <div className="flex gap-2">
        {(retention.returnRates ?? []).map((r: any) => (
          <div key={r.month} className="flex-1 text-center">
            <div className="text-xs text-slate-400">M+{r.month}</div>
            <div className="mt-1 rounded bg-primary/10 py-2 text-sm font-bold text-primary">
              {(r.rate * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}
