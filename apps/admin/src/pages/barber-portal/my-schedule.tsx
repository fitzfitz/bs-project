import { useSessionStore } from "@/features/auth/store";
import { useBranchStore } from "@/store/use-branch-store";
import { BranchSelector } from "@/components/branch-selector";
import { useQueue, type QueueEntry } from "@/features/queue/api/use-queue";
import { User, Clock, Scissors } from "lucide-react";

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

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function EntryCard({ entry }: { entry: QueueEntry }) {
  const customerName =
    entry.customerName ??
    (entry.customer ? `${entry.customer.firstName} ${entry.customer.lastName}`.trim() : "—");
  const services =
    entry.services?.map((s) => s.service.name).join(", ") ??
    entry.booking?.items?.map((i) => i.service.name).join(", ") ??
    "—";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="font-medium text-slate-900 truncate">{customerName}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(entry.scheduledFor ?? entry.createdAt)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <Scissors className="h-3.5 w-3.5" />
            <span className="line-clamp-2">{services}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
            STATUS_BADGE[entry.status] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          {STATUS_LABEL[entry.status] ?? entry.status}
        </span>
      </div>
    </div>
  );
}

export default function MySchedulePage() {
  const staffProfileId = useSessionStore((s) => s.user?.staffProfile?.id);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, error } = useQueue({
    branchId: selectedBranchId,
    date: today,
    staffProfileId: staffProfileId ?? undefined,
  });

  const entries = (data?.data ?? []) as QueueEntry[];

  if (!staffProfileId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">My Schedule</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Barber profile not found. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">My Schedule</h1>
        <BranchSelector />
      </div>

      {!selectedBranchId ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          Select a branch to view your schedule.
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          No appointments scheduled for today.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
