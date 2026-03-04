import { useState } from "react";
import { useSessionStore } from "@/features/auth/store";
import {
  useAttendance,
  type AttendanceRecord,
} from "@/features/attendance/api/use-attendance";

function hoursWorked(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "Active";
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function MyAttendancePage() {
  const staffProfileId = useSessionStore((s) => s.user?.staffProfile?.id);
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Barber profile not found. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Attendance</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading...</div>
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
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Clock In</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Clock Out</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Hours</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No attendance records in this period.
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
                Prev
              </button>
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
