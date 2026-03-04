import { useState } from "react";
import { BranchSelector } from "@/components/branch-selector";
import { FinanceOverview } from "@/features/finance/widgets/finance-overview";

export default function FinancePage() {
  const [dateRange, setDateRange] = useState({ from: getDefaultFrom(), to: getDefaultTo() });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Financial Oversight</h1>
        <BranchSelector />
        <div className="ml-auto flex items-center gap-2">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm"
          />
          <span className="text-sm text-slate-400">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      <FinanceOverview dateFrom={dateRange.from} dateTo={dateRange.to} />
    </div>
  );
}

function getDefaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function getDefaultTo() {
  return new Date().toISOString().slice(0, 10);
}
