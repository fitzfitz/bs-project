import { usePayrollPeriods } from "../api/use-payroll-periods";

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

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading...</p>;
  if (error) return <p className="text-destructive py-8 text-center">{error.message}</p>;

  const items = (data?.data ?? []) as PayrollItem[];
  const pagination = (data as { pagination?: { page: number; totalPages: number; total: number } })?.pagination;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Payroll Periods</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-slate-600">Barber</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Period</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Payout</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
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
