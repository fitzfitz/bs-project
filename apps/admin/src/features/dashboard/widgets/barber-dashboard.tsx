import { useSessionStore } from "@/features/auth/store";
import { useBranchStore } from "@/store/use-branch-store";
import { useQueue, type QueueEntry } from "@/features/queue/api/use-queue";
import { useMyEarnings } from "@/features/commissions/api/use-earnings";
import { BranchSelector } from "@/components/branch-selector";
import { Calendar, Coins, ListOrdered } from "lucide-react";

export function BarberDashboard() {
  const staffProfileId = useSessionStore((s) => s.user?.staffProfile?.id);
  const firstName = useSessionStore((s) => s.user?.firstName);
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const { data: queueData, isLoading: qLoading } = useQueue({
    branchId,
    date: today,
    staffProfileId: staffProfileId ?? undefined,
  });

  const { data: earningsData, isLoading: eLoading } = useMyEarnings({
    dateFrom: today,
    dateTo: today,
  });

  const entries = (queueData?.data ?? []) as QueueEntry[];
  const activeEntries = entries.filter((e) =>
    ["WAITING", "CALLED", "IN_SERVICE"].includes(e.status)
  );
  const completedEntries = entries.filter((e) =>
    ["COMPLETED", "AT_CHECKOUT", "PAID"].includes(e.status)
  );

  const earnings = earningsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">
          Welcome{firstName ? `, ${firstName}` : ""}
        </h1>
        <BranchSelector />
      </div>

      {!branchId ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          Select a branch to view your dashboard.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListOrdered className="h-4 w-4" />
              <span>Active Queue</span>
            </div>
            <p className="mt-1 text-2xl font-semibold">
              {qLoading ? "..." : activeEntries.length}
            </p>
            <p className="text-xs text-muted-foreground">clients waiting / in service</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Completed Today</span>
            </div>
            <p className="mt-1 text-2xl font-semibold">
              {qLoading ? "..." : completedEntries.length}
            </p>
            <p className="text-xs text-muted-foreground">services done</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="h-4 w-4" />
              <span>Today&apos;s Earnings</span>
            </div>
            <p className="mt-1 text-2xl font-semibold">
              {eLoading ? "..." : `${earnings.length} entries`}
            </p>
            <p className="text-xs text-muted-foreground">commission records</p>
          </div>
        </div>
      )}

      {branchId && !qLoading && activeEntries.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Upcoming Clients</h2>
          <div className="divide-y rounded-lg border bg-white">
            {activeEntries.map((entry) => {
              const name =
                entry.customerName ??
                (entry.customer
                  ? `${entry.customer.firstName} ${entry.customer.lastName}`.trim()
                  : "Walk-in");
              const services =
                entry.services?.map((s) => s.service.name).join(", ") ??
                entry.booking?.items?.map((i) => i.service.name).join(", ") ??
                "";
              return (
                <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{name}</p>
                    {services && (
                      <p className="text-xs text-muted-foreground">{services}</p>
                    )}
                  </div>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    {entry.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
