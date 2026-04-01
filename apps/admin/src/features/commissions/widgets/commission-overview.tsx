import { useEarnings, type StaffEarning } from "../api/use-earnings";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

export function CommissionOverview({ page }: { page: number }) {
  const org = useSessionStore((s) => s.user?.organization);
  const { data, isLoading, error } = useEarnings({ page });

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading...</p>;
  if (error) return <p className="text-destructive py-8 text-center">{error.message}</p>;

  const items: StaffEarning[] = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Earnings</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-slate-600">Barber</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Base</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Commission</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Tips</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No earnings data found
                </td>
              </tr>
            ) : (
              items.map((e) => {
                const staffName = `${e.staff.user.firstName} ${e.staff.user.lastName}`.trim();
                return (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-700">{staffName}</td>
                    <td className="px-3 py-2 text-slate-600">{e.date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(e.commissionBase, org?.currency, org?.locale)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(e.commission, org?.currency, org?.locale)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(e.tips, org?.currency, org?.locale)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatCurrency(e.total, org?.currency, org?.locale)}
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
