import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useMyEarnings } from "@/features/commissions/api/use-earnings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

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
  const org = useSessionStore((s) => s.user?.organization);
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useMyEarnings({ page });

  const items = (data?.data ?? []) as EarningItem[];
  const pagination = (data as { pagination?: { page: number; totalPages: number; total: number } })?.pagination;

  const totalEarned = items.reduce((sum, e) => sum + e.total, 0);

  return (
    <PageContainer>
      <PageHeader title={t("barber-portal:myCommissions")} />

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">{t("common:loading")}</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total earned (this page)</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrency(totalEarned, org?.currency, org?.locale)}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("commissions:date")}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t("commissions:base")}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t("commissions:commission")}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t("commissions:tips")}</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">{t("commissions:totalColumn")}</th>
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
                {t("common:page")} {page} {t("common:of")} {pagination.totalPages}
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
    </PageContainer>
  );
}
