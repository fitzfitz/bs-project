import { useState } from "react";
import { useMyEarnings } from "@/features/commissions/api/use-earnings";
import { ChevronLeft, ChevronRight } from "lucide-react";

type EarningItem = {
  id: string;
  staffProfileId: string;
  date: string;
  commissionBase: number;
  commission: number;
  tips: number;
  total: number;
};

export default function MyCommissionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useMyEarnings({ page });

  const items = (data?.data ?? []) as EarningItem[];
  const pagination = (data as { pagination?: { page: number; totalPages: number; total: number } })?.pagination;

  const totalEarned = items.reduce((sum, e) => sum + e.total, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Commissions</h1>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total earned (this page)</p>
            <p className="text-2xl font-semibold text-slate-900">
              Rp {totalEarned.toLocaleString("id-ID")}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
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
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No earnings data found
                    </td>
                  </tr>
                ) : (
                  items.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-700">{e.date}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        Rp {e.commissionBase.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        Rp {e.commission.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        Rp {e.tips.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        Rp {e.total.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
