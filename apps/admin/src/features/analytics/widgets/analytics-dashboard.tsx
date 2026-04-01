import { useState } from "react";
import { useBranchStore } from "@/store/use-branch-store";
import { useGlobalDashboard } from "../api/use-global-dashboard";
import { useBranchComparison } from "../api/use-branch-comparison";
import { usePeakHeatmap } from "../api/use-peak-heatmap";
import { useRetention } from "../api/use-retention";
import { useUtilization } from "../api/use-utilization";
import { useDemandForecast, useComputeForecast } from "../api/use-demand-forecast";
import { useScheduleSuggestions, useComputeSuggestions, useUpdateSuggestion, type ScheduleSuggestion } from "../api/use-schedule-suggestions";
import { useChurnScores, useComputeChurn, type ChurnItem } from "../api/use-churn-scores";
import type { BranchDashboardItem, GlobalDashboardAlert } from "../api/use-global-dashboard";
import type { BranchComparisonRow } from "../api/use-branch-comparison";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

const TABS = [
  "Overview",
  "Comparison",
  "Peak Hours",
  "Retention",
  "Utilization",
  "Forecast",
  "Smart Schedule",
  "Churn Risk",
] as const;
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
      {tab === "Utilization" && <UtilizationTab branchId={branchId} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "Forecast" && <ForecastTab branchId={branchId} />}
      {tab === "Smart Schedule" && <SmartScheduleTab branchId={branchId} />}
      {tab === "Churn Risk" && <ChurnRiskTab branchId={branchId} />}
    </div>
  );
}

function OverviewTab({ dateFrom }: { dateFrom: string; dateTo: string }) {
  const org = useSessionStore((s) => s.user?.organization);
  const { data, isLoading } = useGlobalDashboard(dateFrom);

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}</div>;

  const dashboard = data?.data;
  if (!dashboard) return <p className="text-sm text-slate-500">No data available.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(dashboard.totals?.totalRevenue ?? 0, org?.currency, org?.locale)} />
        <StatCard label="Transactions" value={String(dashboard.totals?.totalTransactions ?? 0)} />
        <StatCard label="Active Barbers" value={String(dashboard.totals?.totalActiveBarbers ?? 0)} />
        <StatCard label="Queue Entries" value={String(dashboard.totals?.totalQueueEntries ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(dashboard.branches ?? []).map((b: BranchDashboardItem) => (
          <div key={b.branchId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{b.branchName}</h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${b.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {b.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-400">Revenue</span>
                <p className="font-medium">
                  {formatCurrency(b.revenue ?? 0, org?.currency, org?.locale)}
                </p>
              </div>
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
          {dashboard.alerts.map((a: GlobalDashboardAlert, i: number) => (
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
  const org = useSessionStore((s) => s.user?.organization);
  const { data, isLoading } = useBranchComparison({ dateFrom, dateTo, metric: "revenue" });
  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const items = data?.data ?? [];
  if (items.length === 0) return <p className="text-sm text-slate-500">No comparison data.</p>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 font-semibold">Branch Revenue Comparison</h3>
      <div className="space-y-3">
        {items.map((b: BranchComparisonRow) => (
          <div key={b.branchId} className="flex items-center gap-3">
            <span className="w-32 truncate text-sm font-medium">{b.branchName}</span>
            <div className="flex-1 rounded-full bg-slate-100">
              <div
                className="h-6 rounded-full bg-primary/80"
                style={{ width: `${Math.min(100, (b.total / Math.max(...items.map((x: BranchComparisonRow) => x.total || 1))) * 100)}%` }}
              />
            </div>
            <span className="w-28 text-right text-sm font-medium">
              {formatCurrency(b.total ?? 0, org?.currency, org?.locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapTab({ branchId, dateFrom, dateTo }: { branchId?: string | null; dateFrom: string; dateTo: string }) {
  const { data, isLoading } = usePeakHeatmap({ branchId: branchId ?? undefined, dateFrom, dateTo });
  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const heatmap = data?.data?.heatmap;
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
  const retention = data?.data;
  if (!retention) return <p className="text-sm text-slate-500">No retention data.</p>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 font-semibold">Customer Retention (Cohort: {cohortMonth})</h3>
      <p className="mb-4 text-sm text-slate-500">Cohort size: {retention.cohortSize} customers</p>
      <div className="flex gap-2">
        {(retention.returnRates ?? []).map((r) => (
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

function UtilizationTab({ branchId, dateFrom, dateTo }: { branchId?: string | null; dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useUtilization({ branchId: branchId ?? undefined, dateFrom, dateTo });
  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const util = data?.data;
  if (!util) return <p className="text-sm text-slate-500">No utilization data.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Overall Utilization" value={`${util.overallRate}%`} />
        <StatCard label="Available Hours" value={String(Math.round(util.totalAvailableMinutes / 60))} />
        <StatCard label="Busy Hours" value={String(Math.round(util.totalBusyMinutes / 60))} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-4 font-semibold">Per-Barber Utilization</h3>
        {util.barbers.length === 0 ? (
          <p className="text-sm text-slate-500">No barber data for this period.</p>
        ) : (
          <div className="space-y-3">
            {util.barbers.map((b) => (
              <div key={b.staffProfileId} className="flex items-center gap-3">
                <span className="w-36 truncate text-sm font-medium">{b.name}</span>
                <div className="flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-6 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, b.utilizationRate)}%`,
                      backgroundColor: b.utilizationRate >= 80 ? "#22c55e" : b.utilizationRate >= 50 ? "#eab308" : "#ef4444",
                    }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-bold">{b.utilizationRate}%</span>
                <span className="w-28 text-right text-xs text-slate-400">{b.servicesCount} services</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastTab({ branchId }: { branchId: string | null }) {
  const org = useSessionStore((s) => s.user?.organization);
  const { data, isLoading } = useDemandForecast(branchId);
  const compute = useComputeForecast();

  if (!branchId) return <p className="text-sm text-slate-500">Select a branch to view forecasts.</p>;
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;

  const forecasts = data?.forecasts ?? [];
  const mape = data?.accuracy?.mape ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => compute.mutate(branchId)}
          disabled={compute.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {compute.isPending ? "Computing..." : "Compute Forecast"}
        </button>
        {mape > 0 && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">MAPE: {mape}%</span>
        )}
      </div>
      {forecasts.length === 0 ? (
        <p className="text-sm text-slate-500">No forecasts available. Click Compute Forecast to generate.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Day</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Pred. Tx</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Pred. Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Confidence Range</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Holiday</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr key={f.date} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-slate-700">{f.date}</td>
                  <td className="px-4 py-3 text-slate-500">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][f.dayOfWeek]}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{f.predictedTransactions.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(f.predictedRevenue, org?.currency, org?.locale)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {formatCurrency(f.confidenceLow, org?.currency, org?.locale)} —{" "}
                    {formatCurrency(f.confidenceHigh, org?.currency, org?.locale)}
                  </td>
                  <td className="px-4 py-3 text-center">{f.isHoliday ? <span className="text-amber-600">🏖️</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SmartScheduleTab({ branchId }: { branchId: string | null }) {
  const { data, isLoading } = useScheduleSuggestions(branchId);
  const compute = useComputeSuggestions();
  const update = useUpdateSuggestion();

  if (!branchId) return <p className="text-sm text-slate-500">Select a branch to view suggestions.</p>;
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;

  const suggestions: ScheduleSuggestion[] = data ?? [];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => compute.mutate(branchId)}
        disabled={compute.isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {compute.isPending ? "Computing..." : "Compute Suggestions"}
      </button>
      {suggestions.length === 0 ? (
        <p className="text-sm text-slate-500">No suggestions. Schedule is balanced, or compute suggestions first.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-4 shadow-sm ${s.demandScore > 1 ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}
            >
              <div className="text-sm font-medium text-slate-800">{s.date?.slice(0, 10)}</div>
              <div className="mt-1 text-xs text-slate-500">
                {s.suggestedStart} — {s.suggestedEnd}
              </div>
              <div className="mt-2 text-sm text-slate-700">{s.reason}</div>
              <div className="mt-1 text-xs text-slate-400">Demand Score: {s.demandScore?.toFixed(2)}</div>
              {s.status === "PENDING" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: s.id, status: "ACCEPTED" })}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: s.id, status: "REJECTED" })}
                    className="rounded bg-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-300"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <div
                  className={`mt-3 text-xs font-medium ${s.status === "ACCEPTED" ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {s.status}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChurnRiskTab({ branchId }: { branchId: string | null }) {
  const [riskFilter, setRiskFilter] = useState<string | undefined>(undefined);
  const { data, isLoading } = useChurnScores(branchId, { riskLevel: riskFilter });
  const compute = useComputeChurn();

  if (!branchId) return <p className="text-sm text-slate-500">Select a branch to view churn risk.</p>;
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;

  const scores: ChurnItem[] = data?.data ?? [];
  const pagination = data?.pagination;

  const riskColors: Record<string, string> = {
    LOW: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => compute.mutate(branchId)}
          disabled={compute.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {compute.isPending ? "Computing..." : "Run Churn Analysis"}
        </button>
        <div className="flex gap-2">
          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setRiskFilter(riskFilter === level ? undefined : level)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                riskFilter === level
                  ? `${riskColors[level]} ring-2 ring-offset-1`
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        {pagination != null && (
          <span className="ml-auto text-xs text-slate-400">{pagination.total} customers</span>
        )}
      </div>
      {scores.length === 0 ? (
        <p className="text-sm text-slate-500">No churn data. Run analysis first.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Customer</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Score</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Risk Level</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Last Visit (days)</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Recent Visits</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Spend Trend</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.customerId} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{s.customerName}</div>
                    <div className="text-xs text-slate-400">{s.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{(s.score * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskColors[s.riskLevel] ?? ""}`}>
                      {s.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{s.features?.recencyDays ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{s.features?.recentVisits ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {s.features?.monetaryTrend !== undefined ? (
                      <span className={s.features.monetaryTrend >= 0 ? "text-emerald-600" : "text-red-500"}>
                        {(s.features.monetaryTrend * 100).toFixed(0)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
