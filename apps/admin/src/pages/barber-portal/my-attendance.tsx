import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useSessionStore } from "@/features/auth/store";
import {
  useAttendance,
  type AttendanceRecord,
} from "@/features/attendance/api/use-attendance";

export default function MyAttendancePage() {
  const { t } = useTranslation();
  const staffProfileId = useSessionStore((s) => s.user?.staffProfile?.id);

  function hoursWorked(clockIn: string, clockOut: string | null): string {
    if (!clockOut) return t("attendance:shiftActive");
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.round((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useAttendance({
    staffProfileId: staffProfileId ?? undefined,
    startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
    endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
    page,
  });

  const attendance = (data?.data ?? []) as AttendanceRecord[];
  const pagination = (data as { pagination?: { page: number; totalPages: number; total: number } })?.pagination;

  if (!staffProfileId) {
    return (
      <PageContainer>
        <PageHeader title={t("barber-portal:myAttendance")} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("barber-portal:staffProfileNotFound")}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("barber-portal:myAttendance")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("common:dateFrom")}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("common:dateTo")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        }
      />

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">{t("common:loading")}</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("attendance:clockIn")}</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("attendance:clockOut")}</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("attendance:duration")}</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("attendance:notes")}</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      {t("barber-portal:noAttendanceInPeriod")}
                    </td>
                  </tr>
                ) : (
                  attendance.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(r.clockIn).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.clockOut ? new Date(r.clockOut).toLocaleString("id-ID") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-medium ${
                            r.clockOut ? "text-slate-600" : "text-green-600"
                          }`}
                        >
                          {hoursWorked(r.clockIn, r.clockOut)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
              >
                {t("common:previous")}
              </button>
              <span className="text-muted-foreground">
                {t("common:page")} {pagination.page} {t("common:of")} {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
              >
                {t("common:next")}
              </button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
