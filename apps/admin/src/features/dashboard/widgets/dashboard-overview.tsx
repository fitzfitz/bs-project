import { useState, useEffect } from "react";
import { useBranches } from "@/features/pos/api/use-branches";
import { useBranchStore } from "@/store/use-branch-store";
import { useDailySummary } from "../api/use-daily-summary";
import { BranchSelector } from "@/components/branch-selector";

export function DashboardOverview() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data: branchesData } = useBranches();
  const branches = branchesData?.data ?? [];
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedBranchId, branches, setSelectedBranchId]);

  const branchId = selectedBranchId ?? "";
  const { data, isLoading, error } = useDailySummary(branchId, date);

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">{error.message}</div>;
  const s = data?.data;
  if (!s) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <BranchSelector />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-semibold">{s.totalRevenue.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded border bg-card p-4">
          <p className="text-sm text-muted-foreground">Service Revenue</p>
          <p className="text-2xl font-semibold">{s.totalServiceRevenue.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded border bg-card p-4">
          <p className="text-sm text-muted-foreground">Product Revenue</p>
          <p className="text-2xl font-semibold">{s.totalProductRevenue.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded border bg-card p-4">
          <p className="text-sm text-muted-foreground">Tips</p>
          <p className="text-2xl font-semibold">{s.totalTips.toLocaleString("id-ID")}</p>
        </div>
      </div>
      <div className="rounded border p-4">
        <h2 className="font-semibold">Payment methods</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {Object.entries(s.paymentMethods || {}).map(([method, amount]) => (
            <li key={method}>{method}: {amount.toLocaleString("id-ID")}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">Transactions: {s.count}</p>
      </div>
    </div>
  );
}
