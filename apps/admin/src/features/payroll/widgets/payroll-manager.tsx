import { useState, useCallback, useMemo } from "react";
import { usePayrollPeriods } from "../api/use-payroll-periods";
import { useBulkApprovePayroll, useBulkDisbursePayroll } from "../api/use-bulk-payroll";

type PayrollItem = {
  id: string;
  staffProfileId: string;
  periodStart: string;
  periodEnd: string;
  totalPayout: number;
  status: string;
  staff?: { user: { firstName: string; lastName: string } };
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
  DISBURSED: "bg-blue-100 text-blue-700",
};

export function PayrollManager({ page }: { page: number }) {
  const { data, isLoading, error } = usePayrollPeriods({ page });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulkApprove = useBulkApprovePayroll();
  const bulkDisburse = useBulkDisbursePayroll();

  const items = useMemo(() => (data?.data ?? []) as PayrollItem[], [data]);
  const pagination = (data as { pagination?: { page: number; totalPages: number; total: number } })?.pagination;

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }, [items, selected.size]);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const canApprove = selected.size > 0 && selectedItems.every((i) => i.status === "PENDING_APPROVAL");
  const canDisburse = selected.size > 0 && selectedItems.every((i) => i.status === "APPROVED");

  const handleBulkApprove = () => {
    bulkApprove.mutate({ ids: Array.from(selected) }, {
      onSuccess: () => setSelected(new Set()),
    });
  };

  const handleBulkDisburse = () => {
    bulkDisburse.mutate({ ids: Array.from(selected) }, {
      onSuccess: () => setSelected(new Set()),
    });
  };

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading...</p>;
  if (error) return <p className="text-destructive py-8 text-center">{error.message}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Payroll Periods</h2>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <button
              onClick={handleBulkApprove}
              disabled={!canApprove || bulkApprove.isPending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkApprove.isPending ? "Approving..." : "Approve Selected"}
            </button>
            <button
              onClick={handleBulkDisburse}
              disabled={!canDisburse || bulkDisburse.isPending}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkDisburse.isPending ? "Disbursing..." : "Disburse Selected"}
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Staff</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Period</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Payout</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No payroll periods found
                </td>
              </tr>
            ) : (
              items.map((e) => {
                const staffName = e.staff
                  ? `${e.staff.user.firstName} ${e.staff.user.lastName}`.trim()
                  : e.staffProfileId.slice(0, 8) + "...";
                return (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleItem(e.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-700">{staffName}</td>
                    <td className="px-3 py-2 text-slate-600">{e.periodStart} – {e.periodEnd}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {e.totalPayout.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[e.status] ?? "bg-muted text-muted-foreground"}`}>
                        {e.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="mt-3 text-xs text-muted-foreground text-right">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
        </div>
      )}
    </div>
  );
}
