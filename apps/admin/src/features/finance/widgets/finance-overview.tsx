import { useBranchStore } from "@/store/use-branch-store";
import { usePLSummary, type PLSummary } from "../api/use-finance";
import { TrendingUp, TrendingDown, DollarSign, Percent, Receipt, Ban } from "lucide-react";

export function FinanceOverview({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const branchId = useBranchStore((s) => s.selectedBranchId);

  const { data, isLoading } = usePLSummary({
    dateFrom,
    dateTo,
    branchId: branchId ?? undefined,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const pl: PLSummary | undefined = (data as any)?.data;
  if (!pl) return <p className="text-sm text-slate-500">No financial data available for this period.</p>;

  const isProfit = pl.grossProfit >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FinanceCard
          label="Total Revenue"
          value={`Rp ${pl.revenue.totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          sub={`Services: Rp ${pl.revenue.serviceRevenue.toLocaleString()}`}
        />
        <FinanceCard
          label="Gross Profit"
          value={`Rp ${pl.grossProfit.toLocaleString()}`}
          icon={isProfit ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
          sub={`Margin: ${pl.margins.grossMarginPercent}%`}
          highlight={!isProfit ? "red" : undefined}
        />
        <FinanceCard
          label="Total Costs"
          value={`Rp ${pl.costs.totalCosts.toLocaleString()}`}
          icon={<Receipt className="h-5 w-5 text-orange-600" />}
          sub={`Commission: Rp ${pl.costs.totalCommissions.toLocaleString()}`}
        />
        <FinanceCard
          label="PPN Collected"
          value={`Rp ${pl.taxes.ppnCollected.toLocaleString()}`}
          icon={<Percent className="h-5 w-5 text-blue-600" />}
          sub={`Tips: Rp ${pl.revenue.tipsCollected.toLocaleString()}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Revenue Breakdown</h3>
          <div className="space-y-3">
            <BarRow label="Service Revenue" value={pl.revenue.serviceRevenue} total={pl.revenue.totalRevenue} color="bg-primary" />
            <BarRow label="Product Revenue" value={pl.revenue.productRevenue} total={pl.revenue.totalRevenue} color="bg-blue-500" />
            <BarRow label="Tips" value={pl.revenue.tipsCollected} total={pl.revenue.totalRevenue} color="bg-emerald-500" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Cost Breakdown</h3>
          <div className="space-y-3">
            <BarRow label="Commissions" value={pl.costs.totalCommissions} total={pl.costs.totalCosts || 1} color="bg-amber-500" />
            <BarRow label="Payroll" value={pl.costs.totalPayroll} total={pl.costs.totalCosts || 1} color="bg-purple-500" />
            <BarRow label="Inventory COGS" value={pl.costs.inventoryCOGS} total={pl.costs.totalCosts || 1} color="bg-slate-500" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="h-4 w-4 text-red-500" />
            <h3 className="font-semibold text-red-700">Voids</h3>
          </div>
          <p className="text-2xl font-bold text-red-700">Rp {pl.voidsTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-amber-700">Discounts Given</h3>
          </div>
          <p className="text-2xl font-bold text-amber-700">Rp {pl.discountsGiven.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ label, value, icon, sub, highlight }: {
  label: string; value: string; icon: React.ReactNode; sub: string; highlight?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight === "red" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
        {icon}
      </div>
      <div className={`mt-2 text-xl font-bold ${highlight === "red" ? "text-red-700" : "text-slate-800"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">Rp {value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
