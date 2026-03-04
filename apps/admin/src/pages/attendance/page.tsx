import { useState } from "react";
import { BranchSelector } from "@/components/branch-selector";
import { useBranchStore } from "@/store/use-branch-store";
import {
  useAttendance,
  useShifts,
  useCreateShift,
  useDeleteShift,
  type AttendanceRecord,
  type ShiftBlock,
} from "@/features/attendance/api/use-attendance";
import { useBarbers } from "@/features/barbers/api/use-barbers";

type Tab = "attendance" | "shifts";

export default function AttendancePage() {
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const [tab, setTab] = useState<Tab>("attendance");
  const [page, setPage] = useState(1);
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCreateShift, setShowCreateShift] = useState(false);

  const { data: attendanceData, isLoading: loadingAttendance } = useAttendance({
    branchId: selectedBranchId,
    page,
  });
  const { data: shiftData, isLoading: loadingShifts } = useShifts({
    branchId: selectedBranchId,
    date: shiftDate,
  });
  const { data: barbersData } = useBarbers({ branchId: selectedBranchId });

  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();

  const attendance = attendanceData?.data ?? [];
  const attPagination = attendanceData?.pagination;
  const shifts = shiftData?.data ?? [];
  const barbers = barbersData?.data ?? [];

  const [formStaffProfileId, setFormStaffProfileId] = useState("");
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("17:00");
  const [formNotes, setFormNotes] = useState("");

  const handleCreateShift = async () => {
    if (!formStaffProfileId) return;
    await createShift.mutateAsync({
      staffProfileId: formStaffProfileId,
      branchId: selectedBranchId,
      date: shiftDate,
      startTime: formStart,
      endTime: formEnd,
      notes: formNotes || undefined,
    });
    setShowCreateShift(false);
    setFormStaffProfileId("");
    setFormNotes("");
  };

  function hoursWorked(clockIn: string, clockOut: string | null): string {
    if (!clockOut) return "Active";
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.round((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Attendance & Shifts</h1>
        <BranchSelector />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["attendance", "shifts"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "attendance" ? "Attendance Log" : "Shift Schedule"}
          </button>
        ))}
      </div>

      {tab === "attendance" && (
        <>
          {loadingAttendance ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Barber</th>
                    <th className="px-3 py-2 text-left font-medium">Clock In</th>
                    <th className="px-3 py-2 text-left font-medium">Clock Out</th>
                    <th className="px-3 py-2 text-left font-medium">Hours</th>
                    <th className="px-3 py-2 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No attendance records.</td></tr>
                  ) : attendance.map((r: AttendanceRecord) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.staff?.user?.firstName ?? ""} {r.staff?.user?.lastName ?? ""}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.clockIn).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.clockOut ? new Date(r.clockOut).toLocaleString("id-ID") : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${r.clockOut ? "" : "text-green-600"}`}>
                          {hoursWorked(r.clockIn, r.clockOut)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {attPagination && attPagination.totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Prev</button>
              <span>Page {attPagination.page} of {attPagination.totalPages}</span>
              <button disabled={page >= attPagination.totalPages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}

      {tab === "shifts" && (
        <>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCreateShift(true)}
              className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground"
            >
              + Add Shift
            </button>
          </div>

          {loadingShifts ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Barber</th>
                    <th className="px-3 py-2 text-left font-medium">Start</th>
                    <th className="px-3 py-2 text-left font-medium">End</th>
                    <th className="px-3 py-2 text-left font-medium">Notes</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shifts.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No shifts scheduled for this date.</td></tr>
                  ) : shifts.map((s: ShiftBlock) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{s.staff?.user?.firstName ?? ""} {s.staff?.user?.lastName ?? ""}</td>
                      <td className="px-3 py-2">{s.startTime}</td>
                      <td className="px-3 py-2">{s.endTime}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.notes || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => { if (confirm("Delete this shift?")) deleteShift.mutate(s.id); }}
                          className="text-destructive text-xs hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showCreateShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateShift(false)}>
              <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-4">Add Shift Block</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Barber</label>
                    <select value={formStaffProfileId} onChange={(e) => setFormStaffProfileId(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm">
                      <option value="">Select barber</option>
                      {barbers.map((b) => <option key={b.id} value={b.id}>{b.user.firstName} {b.user.lastName}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start</label>
                      <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End</label>
                      <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Optional" />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateShift}
                    disabled={!formStaffProfileId || createShift.isPending}
                    className="w-full rounded bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {createShift.isPending ? "Creating..." : "Create Shift"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
