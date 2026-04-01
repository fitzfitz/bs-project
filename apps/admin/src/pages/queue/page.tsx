import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BranchSelector } from "@/components/branch-selector";
import { useBranchStore } from "@/store/use-branch-store";
import {
  useQueue,
  useUpdateQueueStatus,
  useAssignStaff,
  usePostponeEntry,
  useCancelEntry,
  useCreateEntry,
  type QueueEntry,
} from "@/features/queue/api/use-queue";
import { useBarbers } from "@/features/barbers/api/use-barbers";
import { useServices } from "@/features/pos/api/use-services";
import { usePusherChannel } from "@/hooks/use-pusher";
import {
  Clock,
  Timer,
  User,
  GripVertical,
  CalendarDays,
  UserPlus,
  X,
  Phone,
  Scissors,
  FileText,
  ArrowRight,
} from "lucide-react";

/* ========================================================================== */
/*  CONSTANTS                                                                 */
/* ========================================================================== */

const LANES = ["WAITING", "CALLED", "IN_SERVICE", "COMPLETED"] as const;
type LaneStatus = (typeof LANES)[number];

const LANE_META: Record<
  LaneStatus,
  { label: string; bg: string; border: string; dot: string }
> = {
  WAITING: { label: "Waiting", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  CALLED: { label: "Called", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400" },
  IN_SERVICE: { label: "In Service", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-400" },
  COMPLETED: { label: "Completed", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400" },
};

const STATUS_BADGE: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-800",
  CALLED: "bg-blue-100 text-blue-800",
  IN_SERVICE: "bg-green-100 text-green-800",
  COMPLETED: "bg-slate-100 text-slate-700",
  NO_SHOW: "bg-red-100 text-red-800",
  CANCELLED: "bg-red-100 text-red-700",
  AT_CHECKOUT: "bg-purple-100 text-purple-800",
  PAID: "bg-emerald-100 text-emerald-800",
};

const STATUS_LABEL: Record<string, string> = {
  WAITING: "Waiting",
  CALLED: "Called",
  IN_SERVICE: "In Service",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  AT_CHECKOUT: "Checkout",
  PAID: "Paid",
};

const SOURCE_LABEL: Record<string, string> = {
  APP: "App",
  WEB: "Web",
  WALK_IN: "Walk-in",
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function getRelativeDateLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const target = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < -1) return "Expired";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

const DATE_LABEL_COLOR: Record<string, string> = {
  Expired: "text-red-500",
  Yesterday: "text-red-400",
  Today: "text-emerald-600",
  Tomorrow: "text-blue-500",
};

/* ========================================================================== */
/*  MAIN PAGE                                                                 */
/* ========================================================================== */

export default function QueuePage() {
  const { t } = useTranslation();
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignModal, setAssignModal] = useState<QueueEntry | null>(null);
  const [selectedStaffProfileId, setSelectedStaffProfileId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overrideLane, setOverrideLane] = useState<Record<string, string>>({});
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<QueueEntry | null>(null);

  const queryKeys = useMemo(() => [["queue"]], []);
  usePusherChannel(branchId ? `branch-${branchId}` : null, "QUEUE_UPDATED", queryKeys);

  const { data, isLoading } = useQueue({ branchId, date });
  const { data: barbersData } = useBarbers({ branchId });
  const updateStatus = useUpdateQueueStatus();
  const assignStaff = useAssignStaff();
  const postpone = usePostponeEntry();
  const cancel = useCancelEntry();

  const entries = useMemo(() => data?.data ?? [], [data?.data]);
  const barbers = barbersData?.data ?? [];

  const lanes = useMemo(() => {
    const grouped: Record<string, QueueEntry[]> = {};
    for (const lane of LANES) grouped[lane] = [];
    for (const e of entries) {
      const effectiveLane = overrideLane[e.id] ?? e.status;
      if (grouped[effectiveLane]) grouped[effectiveLane].push(e);
      else if (grouped[e.status]) grouped[e.status].push(e);
    }
    return grouped;
  }, [entries, overrideLane]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeId) ?? null,
    [entries, activeId]
  );

  const resolveLane = useCallback((over: DragOverEvent["over"] | DragEndEvent["over"]) => {
    if (!over) return null;
    return (
      (over.data.current as { lane?: string })?.lane ??
      (typeof over.id === "string" && over.id.startsWith("lane-")
        ? over.id.replace("lane-", "")
        : null)
    );
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      const targetLane = resolveLane(over);
      if (!targetLane) return;
      const entryId = active.id as string;
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const currentLane = overrideLane[entryId] ?? entry.status;
      if (currentLane === targetLane) return;
      setOverrideLane((prev) => ({ ...prev, [entryId]: targetLane }));
    },
    [entries, overrideLane, resolveLane],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const entryId = active.id as string;
      setActiveId(null);
      setOverrideLane({});
      const targetLane = resolveLane(over);
      if (!targetLane) return;
      const entry = entries.find((e) => e.id === entryId);
      if (!entry || entry.status === targetLane) return;
      updateStatus.mutate({ id: entryId, status: targetLane });
    },
    [entries, updateStatus, resolveLane],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverrideLane({});
  }, []);

  const handleAssign = async () => {
    if (!assignModal || !selectedStaffProfileId) return;
    await assignStaff.mutateAsync({ id: assignModal.id, staffProfileId: selectedStaffProfileId });
    setAssignModal(null);
    setSelectedStaffProfileId("");
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("queue:title")}
        badge={<span className="text-sm text-muted-foreground">{entries.length} entries</span>}
        actions={
          <>
            <BranchSelector />
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="button"
              onClick={() => setWalkInOpen(true)}
              disabled={!branchId}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Walk-In
            </button>
          </>
        }
      />

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {LANES.map((lane) => (
            <div key={lane} className="animate-pulse rounded-xl border-2 border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 h-5 w-20 rounded bg-slate-200" />
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-slate-100" />
                <div className="h-24 rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {LANES.map((lane) => (
              <DroppableLane
                key={lane}
                lane={lane}
                entries={lanes[lane]}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                onAssign={(entry) => setAssignModal(entry)}
                onPostpone={(id) => postpone.mutate({ id })}
                onCancel={(id) => cancel.mutate(id)}
                onCardClick={(entry) => setDetailEntry(entry)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeEntry && <QueueCardOverlay entry={activeEntry} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Assign barber modal */}
      {assignModal && (
        <ModalBackdrop onClose={() => setAssignModal(null)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Assign Barber</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Queue #{assignModal.position} —{" "}
              {assignModal.customer
                ? `${assignModal.customer.firstName} ${assignModal.customer.lastName}`
                : assignModal.customerName ?? "Walk-in"}
            </p>
            <select
              value={selectedStaffProfileId}
              onChange={(e) => setSelectedStaffProfileId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select barber</option>
              {barbers
                .filter((b) => b.status === "AVAILABLE")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.user.firstName} {b.user.lastName} ({b.tier})
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAssignModal(null)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={handleAssign} disabled={!selectedStaffProfileId || assignStaff.isPending} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {assignStaff.isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Walk-in creation modal */}
      {walkInOpen && (
        <WalkInModal
          branchId={branchId}
          barbers={barbers}
          onClose={() => setWalkInOpen(false)}
        />
      )}

      {/* Detail modal */}
      {detailEntry && (
        <EntryDetailModal
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onStatusChange={(status) => {
            updateStatus.mutate({ id: detailEntry.id, status });
            setDetailEntry(null);
          }}
          onAssign={() => {
            setAssignModal(detailEntry);
            setDetailEntry(null);
          }}
          onPostpone={() => {
            postpone.mutate({ id: detailEntry.id });
            setDetailEntry(null);
          }}
          onCancel={() => {
            cancel.mutate(detailEntry.id);
            setDetailEntry(null);
          }}
        />
      )}
    </PageContainer>
  );
}

/* ========================================================================== */
/*  WALK-IN MODAL                                                             */
/* ========================================================================== */

function WalkInModal({
  branchId,
  barbers,
  onClose,
}: {
  branchId: string;
  barbers: { id: string; status: string; tier: string; user: { firstName: string; lastName: string } }[];
  onClose: () => void;
}) {
  const { data: servicesData } = useServices();
  const services = servicesData?.data ?? [];
  const createEntry = useCreateEntry();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [staffProfileId, setStaffProfileId] = useState("");
  const [notes, setNotes] = useState("");

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!customerName.trim() || selectedServiceIds.length === 0) return;
    createEntry.mutate(
      {
        branchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        staffProfileId: staffProfileId || undefined,
        serviceIds: selectedServiceIds,
        startTime: new Date().toISOString(),
        estimatedDuration: totalDuration,
        source: "WALK_IN",
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Add Walk-In</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="08xx-xxxx-xxxx"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Services * <span className="font-normal text-slate-400">({selectedServiceIds.length} selected, ~{totalDuration}m)</span>
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {services.map((s) => {
                const active = selectedServiceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Scissors className="h-3 w-3" />
                    {s.name} ({s.durationMinutes}m)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barber */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Barber (optional)</label>
            <select
              value={staffProfileId}
              onChange={(e) => setStaffProfileId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Any Available</option>
              {barbers
                .filter((b) => b.status === "AVAILABLE")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.user.firstName} {b.user.lastName} ({b.tier})
                  </option>
                ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special requests..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm resize-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {createEntry.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {createEntry.error.message}
            </p>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!customerName.trim() || selectedServiceIds.length === 0 || createEntry.isPending}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {createEntry.isPending ? "Adding..." : "Add to Queue"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* ========================================================================== */
/*  ENTRY DETAIL MODAL                                                        */
/* ========================================================================== */

function EntryDetailModal({
  entry,
  onClose,
  onStatusChange,
  onAssign,
  onPostpone,
  onCancel,
}: {
  entry: QueueEntry;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onAssign: () => void;
  onPostpone: () => void;
  onCancel: () => void;
}) {
  const customerName = entry.customer
    ? `${entry.customer.firstName} ${entry.customer.lastName}`
    : entry.customerName ?? "Walk-in";

  const barberName = entry.staffProfile
    ? `${entry.staffProfile.user.firstName} ${entry.staffProfile.user.lastName}`
    : null;

  const phone = entry.customer?.phone ?? entry.customerPhone;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-slate-400">#{entry.position}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[entry.status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABEL[entry.status] ?? entry.status}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {SOURCE_LABEL[entry.source] ?? entry.source}
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Customer info */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{customerName}</p>
              {phone && (
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" /> {phone}
                </p>
              )}
            </div>
          </div>

          {/* Times grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Scheduled" value={`${getRelativeDateLabel(entry.booking?.scheduledAt ?? entry.scheduledFor ?? entry.createdAt)} ${formatTime(entry.booking?.scheduledAt ?? entry.scheduledFor ?? entry.createdAt)}`.trim()} />
            <InfoBlock label="Est. Duration" value={entry.estimatedDuration && entry.estimatedDuration > 0 ? `${entry.estimatedDuration} min` : "—"} />
            {entry.calledAt && <InfoBlock label="Called At" value={formatDateTime(entry.calledAt)} />}
            {entry.startedAt && <InfoBlock label="Started At" value={formatDateTime(entry.startedAt)} />}
            {entry.completedAt && <InfoBlock label="Completed At" value={formatDateTime(entry.completedAt)} />}
            {entry.estimatedWait != null && entry.estimatedWait > 0 && (
              <InfoBlock label="Est. Wait" value={`~${entry.estimatedWait} min`} />
            )}
          </div>

          {/* Barber */}
          {barberName && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
              <Scissors className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{barberName}</span>
            </div>
          )}

          {/* Services */}
          {entry.services && entry.services.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Services</h4>
              <div className="space-y-1.5">
                {entry.services.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{s.service.name}</span>
                    {s.service.durationMinutes > 0 && (
                      <span className="text-slate-400">{s.service.durationMinutes}m</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking reference */}
          {entry.booking && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Linked Booking</h4>
              <p className="text-sm text-slate-600">
                Scheduled: {formatDateTime(entry.booking.scheduledAt)}
              </p>
              {entry.booking.note && (
                <p className="text-sm text-slate-500 mt-1 flex items-start gap-1">
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {entry.booking.note}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</h4>
              <p className="text-sm text-slate-600">{entry.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {entry.status === "WAITING" && (
              <>
                <ActionBtn label="Call" onClick={() => onStatusChange("CALLED")} icon={<ArrowRight className="h-3.5 w-3.5" />} />
                <ActionBtn label="Assign Barber" onClick={onAssign} variant="outline" />
                <ActionBtn label="Postpone +10m" onClick={onPostpone} variant="outline" />
                <ActionBtn label="Cancel" onClick={onCancel} variant="destructive" />
              </>
            )}
            {entry.status === "CALLED" && (
              <>
                <ActionBtn label="In Service" onClick={() => onStatusChange("IN_SERVICE")} icon={<ArrowRight className="h-3.5 w-3.5" />} />
                <ActionBtn label="No Show" onClick={() => onStatusChange("NO_SHOW")} variant="destructive" />
              </>
            )}
            {entry.status === "IN_SERVICE" && (
              <ActionBtn label="Complete" onClick={() => onStatusChange("COMPLETED")} icon={<ArrowRight className="h-3.5 w-3.5" />} />
            )}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{value}</p>
    </div>
  );
}

/* ========================================================================== */
/*  SHARED COMPONENTS                                                         */
/* ========================================================================== */

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function DroppableLane({
  lane,
  entries,
  onStatusChange,
  onAssign,
  onPostpone,
  onCancel,
  onCardClick,
}: {
  lane: LaneStatus;
  entries: QueueEntry[];
  onStatusChange: (id: string, status: string) => void;
  onAssign: (entry: QueueEntry) => void;
  onPostpone: (id: string) => void;
  onCancel: (id: string) => void;
  onCardClick: (entry: QueueEntry) => void;
}) {
  const meta = LANE_META[lane];
  const ids = entries.map((e) => e.id);
  const { setNodeRef, isOver } = useDroppable({ id: `lane-${lane}`, data: { lane } });

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`rounded-xl border-2 ${meta.border} ${meta.bg} p-3 min-h-[200px] transition-shadow ${isOver ? "ring-2 ring-primary/50 shadow-md" : ""}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{meta.label}</h3>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-500">
            {entries.length}
          </span>
        </div>
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No entries</p>
          ) : (
            entries.map((entry) => (
              <SortableQueueCard
                key={entry.id}
                entry={entry}
                lane={lane}
                onStatusChange={(status) => onStatusChange(entry.id, status)}
                onAssign={() => onAssign(entry)}
                onPostpone={() => onPostpone(entry.id)}
                onCancel={() => onCancel(entry.id)}
                onCardClick={() => onCardClick(entry)}
              />
            ))
          )}
        </div>
      </div>
    </SortableContext>
  );
}

function SortableQueueCard({
  entry,
  lane,
  onStatusChange,
  onAssign,
  onPostpone,
  onCancel,
  onCardClick,
}: {
  entry: QueueEntry;
  lane: string;
  onStatusChange: (status: string) => void;
  onAssign: () => void;
  onPostpone: () => void;
  onCancel: () => void;
  onCardClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    data: { lane },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QueueCard
        entry={entry}
        dragListeners={listeners}
        onStatusChange={onStatusChange}
        onAssign={onAssign}
        onPostpone={onPostpone}
        onCancel={onCancel}
        onCardClick={onCardClick}
      />
    </div>
  );
}

function QueueCard({
  entry,
  dragListeners,
  onStatusChange,
  onAssign,
  onPostpone,
  onCancel,
  onCardClick,
}: {
  entry: QueueEntry;
  dragListeners?: Record<string, unknown>;
  onStatusChange?: (status: string) => void;
  onAssign?: () => void;
  onPostpone?: () => void;
  onCancel?: () => void;
  onCardClick?: () => void;
}) {
  const customerName = entry.customer
    ? `${entry.customer.firstName} ${entry.customer.lastName}`
    : entry.customerName ?? "Walk-in";

  const barberName = entry.staffProfile
    ? `${entry.staffProfile.user.firstName} ${entry.staffProfile.user.lastName}`
    : null;

  const serviceNames = entry.services?.map((s) => s.service.name).join(", ") ?? "";
  const bookingDate = entry.booking?.scheduledAt ?? entry.scheduledFor ?? entry.createdAt;
  const scheduledTime = formatTime(bookingDate);
  const dateLabel = getRelativeDateLabel(bookingDate);
  const dateLabelColor = DATE_LABEL_COLOR[dateLabel] ?? "text-blue-400";

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onCardClick}
    >
      <div className="flex items-center gap-2 mb-2">
        {dragListeners && (
          <button
            type="button"
            className="cursor-grab touch-none text-slate-300 hover:text-slate-500"
            onClick={(e) => e.stopPropagation()}
            {...dragListeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs font-bold text-slate-500">#{entry.position}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[entry.status] ?? "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABEL[entry.status] ?? entry.status}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {SOURCE_LABEL[entry.source] ?? entry.source}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-1">
        <User className="h-3.5 w-3.5 text-slate-400" />
        <p className="font-medium text-sm text-slate-800 truncate">{customerName}</p>
      </div>

      {serviceNames && <p className="text-xs text-muted-foreground truncate mb-1">{serviceNames}</p>}
      {barberName && <p className="text-xs font-medium text-primary truncate mb-1">Barber: {barberName}</p>}

      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dateLabel && <span className={`font-semibold ${dateLabelColor}`}>{dateLabel}</span>}
          {scheduledTime}
        </span>
        {entry.estimatedDuration && entry.estimatedDuration > 0 && (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {entry.estimatedDuration}m
          </span>
        )}
        {entry.estimatedWait != null && entry.estimatedWait > 0 && (
          <span className="text-amber-500">~{entry.estimatedWait}m wait</span>
        )}
      </div>

      {onStatusChange && (
        <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {entry.status === "WAITING" && (
            <>
              <SmallActionBtn label="Call" onClick={() => onStatusChange("CALLED")} />
              <SmallActionBtn label="Assign" onClick={onAssign} variant="outline" />
              <SmallActionBtn label="+10m" onClick={onPostpone} variant="outline" />
              <SmallActionBtn label="Cancel" onClick={onCancel} variant="destructive" />
            </>
          )}
          {entry.status === "CALLED" && (
            <>
              <SmallActionBtn label="In Service" onClick={() => onStatusChange("IN_SERVICE")} />
              <SmallActionBtn label="No Show" onClick={() => onStatusChange("NO_SHOW")} variant="destructive" />
            </>
          )}
          {entry.status === "IN_SERVICE" && (
            <SmallActionBtn label="Complete" onClick={() => onStatusChange("COMPLETED")} />
          )}
        </div>
      )}
    </div>
  );
}

function QueueCardOverlay({ entry }: { entry: QueueEntry }) {
  return (
    <div className="rotate-2 scale-105">
      <QueueCard entry={entry} />
    </div>
  );
}

function SmallActionBtn({
  label,
  onClick,
  variant = "primary",
}: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "outline" | "destructive";
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground"
      : variant === "destructive"
        ? "bg-red-100 text-red-700 hover:bg-red-200"
        : "border text-foreground hover:bg-muted";

  return (
    <button type="button" onClick={onClick} className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </button>
  );
}

function ActionBtn({
  label,
  onClick,
  variant = "primary",
  icon,
}: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "outline" | "destructive";
  icon?: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground"
      : variant === "destructive"
        ? "bg-red-100 text-red-700 hover:bg-red-200"
        : "border text-foreground hover:bg-muted";

  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${cls}`}>
      {icon}
      {label}
    </button>
  );
}
