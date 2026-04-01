import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { useBranches } from "@/features/pos/api/use-branches";
import { useBranchStore } from "@/store/use-branch-store";
import { useDailySummary } from "../api/use-daily-summary";
import { useRevenueTrend } from "../api/use-revenue-trend";
import { BranchSelector } from "@/components/branch-selector";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
];

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function DashboardOverview() {
  const org = useSessionStore((s) => s.user?.organization);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trendDays, setTrendDays] = useState(7);
  const { data: branchesData } = useBranches();
  const branches = useMemo(() => branchesData?.data ?? [], [branchesData?.data]);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedBranchId, branches, setSelectedBranchId]);

  const branchId = selectedBranchId ?? "";
  const { data, isLoading, error } = useDailySummary(branchId, date);
  const { data: trendData } = useRevenueTrend(branchId, trendDays);

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">{error.message}</div>;
  const s = data?.data;
  if (!s) return null;

  const trend = trendData?.data ?? [];
  const paymentEntries = Object.entries(s.paymentMethods || {}).map(
    ([name, value]) => ({ name, value: value as number }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <BranchSelector />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(s.totalRevenue, org?.currency, org?.locale)} />
        <StatCard label="Service Revenue" value={formatCurrency(s.totalServiceRevenue, org?.currency, org?.locale)} />
        <StatCard label="Product Revenue" value={formatCurrency(s.totalProductRevenue, org?.currency, org?.locale)} />
        <StatCard label="Tips" value={formatCurrency(s.totalTips, org?.currency, org?.locale)} sub={`${s.count} transactions`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Revenue Trend</h2>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrendDays(d)}
                  className={`px-2.5 py-1 text-xs rounded-lg ${
                    trendDays === d
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  width={48}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value ?? 0), org?.currency, org?.locale),
                    "Revenue",
                  ]}
                  labelFormatter={(label) => formatShortDate(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              No trend data available
            </div>
          )}
        </div>

        {/* Payment Methods Pie */}
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Payment Methods</h2>
          {paymentEntries.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={paymentEntries}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentEntries.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(Number(value ?? 0), org?.currency, org?.locale)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {paymentEntries.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-600">{entry.name}</span>
                    </div>
                    <span className="font-medium text-slate-700">
                      {formatCurrency(entry.value, org?.currency, org?.locale)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">
              No payment data
            </div>
          )}
        </div>
      </div>

      {/* Booking Volume Bar Chart */}
      {trend.length > 0 && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Transaction Volume</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
              />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={36} />
              <Tooltip
                formatter={(value) => [Number(value ?? 0), "Transactions"]}
                labelFormatter={(label) => formatShortDate(String(label))}
              />
              <Bar dataKey="transactions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
