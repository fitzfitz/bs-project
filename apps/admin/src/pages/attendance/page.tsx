import { useState, useMemo } from "react";
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

type Tab = "attendance" | "shifts" | "calendar";

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
        {([["attendance", "Attendance Log"], ["shifts", "Shift Schedule"], ["calendar", "Calendar"]] as const).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t as Tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
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

      {tab === "calendar" && (
        <WeeklyCalendar
          branchId={selectedBranchId}
          barbers={barbers}
        />
      )}
    </div>
  );
}

function getWeekDates(referenceDate: string): string[] {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

function WeeklyCalendar({ branchId, barbers }: { branchId: string; barbers: Array<{ id: string; user: { firstName: string; lastName: string } }> }) {
  const [weekRef, setWeekRef] = useState(() => new Date().toISOString().slice(0, 10));
  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);

  const shiftQueries = weekDates.map((date) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useShifts({ branchId, date })
  );

  const allShifts: Array<ShiftBlock & { dayIndex: number }> = [];
  shiftQueries.forEach((q, i) => {
    for (const s of (q.data?.data ?? [])) {
      allShifts.push({ ...s, dayIndex: i });
    }
  });

  const barberNames = new Map(barbers.map((b) => [b.id, `${b.user.firstName} ${b.user.lastName}`]));

  const prevWeek = () => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() - 7);
    setWeekRef(d.toISOString().slice(0, 10));
  };
  const nextWeek = () => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() + 7);
    setWeekRef(d.toISOString().slice(0, 10));
  };
  const goToday = () => setWeekRef(new Date().toISOString().slice(0, 10));

  function parseHour(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h + (m ?? 0) / 60;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={prevWeek} className="rounded border px-3 py-1 text-sm">Prev</button>
        <button type="button" onClick={goToday} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground">Today</button>
        <button type="button" onClick={nextWeek} className="rounded border px-3 py-1 text-sm">Next</button>
        <span className="text-sm font-medium">{weekDates[0]} — {weekDates[6]}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <div className="grid min-w-[800px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
          {/* Header */}
          <div className="border-b bg-muted/50 px-2 py-2 text-xs font-medium text-slate-500" />
          {DAY_LABELS.map((label, i) => (
            <div key={label} className="border-b border-l bg-muted/50 px-2 py-2 text-center">
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className="text-xs text-slate-400">{weekDates[i]?.slice(5)}</div>
            </div>
          ))}

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b px-2 py-3 text-right text-xs text-slate-400">{String(hour).padStart(2, "0")}:00</div>
              {weekDates.map((date, di) => {
                const dayShifts = allShifts.filter((s) => s.dayIndex === di);
                const blocksInHour = dayShifts.filter((s) => {
                  const start = parseHour(s.startTime);
                  const end = parseHour(s.endTime);
                  return start <= hour && end > hour;
                });
                return (
                  <div key={date} className="relative border-b border-l px-1 py-1 min-h-[48px]">
                    {blocksInHour.map((s) => (
                      <div
                        key={s.id}
                        className="mb-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary truncate"
                        title={`${barberNames.get(s.staffProfileId) ?? "?"}: ${s.startTime}–${s.endTime}`}
                      >
                        {barberNames.get(s.staffProfileId)?.split(" ")[0] ?? "?"} {s.startTime}–{s.endTime}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
