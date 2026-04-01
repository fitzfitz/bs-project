import { useTranslation } from "react-i18next";
import { Clock, Mail, User, CalendarDays, Bell } from "lucide-react";
import { useAdminWaitlist, type WaitlistEntry } from "../api/use-admin-waitlist";

const STATUS_BADGE: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-800",
  NOTIFIED: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-700",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function WaitlistManagement({ branchId }: { branchId: string }) {
  const { t } = useTranslation("waitlist");
  const { data, isLoading } = useAdminWaitlist(branchId);
  const entries: WaitlistEntry[] = data?.data ?? [];

  if (!branchId) {
    return (
      <div className="text-center py-12 text-slate-400">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p>{t("selectBranch")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="h-5 w-40 rounded bg-slate-200 mb-2" />
            <div className="h-4 w-60 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Clock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p>{t("noEntries")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{t("totalEntries", { count: entries.length })}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">{t("customer")}</th>
              <th className="px-4 py-3 font-semibold text-slate-600">{t("preferredDate")}</th>
              <th className="px-4 py-3 font-semibold text-slate-600">{t("timeSlot")}</th>
              <th className="px-4 py-3 font-semibold text-slate-600">{t("status")}</th>
              <th className="px-4 py-3 font-semibold text-slate-600">{t("notifiedAt")}</th>
              <th className="px-4 py-3 font-semibold text-slate-600">{t("expiresAt")}</th>
              <th className="px-4 py-3 font-semibold text-slate-600">{t("createdAt")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">{entry.customerName}</p>
                      {entry.user?.email && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {entry.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(entry.preferredDate)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    <Clock className="h-3 w-3" />
                    {entry.preferredTimeSlot}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[entry.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {entry.status === "NOTIFIED" && <Bell className="h-3 w-3" />}
                    {t(`status${entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(entry.notifiedAt)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(entry.expiresAt)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
