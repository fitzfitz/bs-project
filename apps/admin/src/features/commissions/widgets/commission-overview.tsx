import { useEarnings } from "../api/use-earnings";

type EarningItem = {
  id: string;
  staffProfileId: string;
  date: string;
  commissionBase: number;
  commission: number;
  tips: number;
  total: number;
  staff?: { user: { firstName: string; lastName: string } };
};

export function CommissionOverview({ page }: { page: number }) {
  const { data, isLoading, error } = useEarnings({ page });

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading...</p>;
  if (error) return <p className="text-destructive py-8 text-center">{error.message}</p>;

  const items = (data?.data ?? []) as EarningItem[];
  const pagination = (data as { pagination?: { page: number; totalPages: number; total: number } })?.pagination;

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
                const staffName = e.staff
                  ? `${e.staff.user.firstName} ${e.staff.user.lastName}`.trim()
                  : e.staffProfileId.slice(0, 8) + "...";
                return (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-700">{staffName}</td>
                    <td className="px-3 py-2 text-slate-600">{e.date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.commissionBase.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.commission.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.tips.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{e.total.toLocaleString("id-ID")}</td>
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
