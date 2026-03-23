import { useState, useEffect, useCallback } from "react";
import { POSCheckout } from "@/features/pos/widgets/pos-checkout";
import { BranchSelector } from "@/components/branch-selector";
import { getOfflineCounts, cleanupSynced } from "@/lib/offline-store";
import { syncPendingTransactions, retryFailedTransactions } from "@/lib/sync-pending";
import { useSessionStore } from "@/features/auth/store";
import { useQueue, type QueueEntry } from "@/features/queue/api/use-queue";
import { useBranchStore } from "@/store/use-branch-store";
import { usePOSStore } from "@/features/pos/store/use-pos-store";
import {
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Monitor,
  Clock,
  User,
  ChevronRight,
  Scissors,
} from "lucide-react";

function OngoingTransactions({
  branchId,
  onSelect,
}: {
  branchId: string;
  onSelect: (entry: QueueEntry) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQueue({ branchId, date: today });
  const entries = (data?.data ?? []).filter(
    (e) => e.status === "AT_CHECKOUT" || e.status === "COMPLETED"
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center text-slate-400">
        <Clock className="h-6 w-6 mb-2 opacity-50" />
        <p className="text-xs">No pending checkouts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const customerName =
          entry.customer
            ? `${entry.customer.firstName} ${entry.customer.lastName}`.trim()
            : entry.customerName ?? "Walk-in";
        const barberName = entry.staffProfile
          ? `${entry.staffProfile.user.firstName} ${entry.staffProfile.user.lastName}`.trim()
          : null;
        const serviceNames =
          entry.services?.map((s) => s.service.name).join(", ") ??
          entry.booking?.items?.map((i) => i.service.name).join(", ") ??
          "—";
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry)}
            className="group w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <User className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 truncate">{customerName}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  entry.status === "AT_CHECKOUT"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}>
                  {entry.status === "AT_CHECKOUT" ? "Checkout" : "Done"}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {barberName && (
                  <span className="inline-flex items-center gap-1 mr-2">
                    <Scissors className="h-3 w-3" />
                    {barberName}
                  </span>
                )}
                {serviceNames}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

export default function POSPage() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const addItem = usePOSStore((s) => s.addItem);
  const setQueueEntryId = usePOSStore((s) => s.setQueueEntryId);
  const reset = usePOSStore((s) => s.reset);

  const refreshCounts = useCallback(async () => {
    const counts = await getOfflineCounts();
    setPendingCount(counts.pending);
    setFailedCount(counts.failed);
  }, []);

  useEffect(() => {
    refreshCounts();
    cleanupSynced(7);
    const interval = setInterval(refreshCounts, 10000);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshCounts]);

  const handleSyncNow = async () => {
    setSyncing(true);
    const getToken = () => useSessionStore.getState().accessToken;
    await syncPendingTransactions(getToken);
    await refreshCounts();
    setSyncing(false);
  };

  const handleRetryFailed = async () => {
    setSyncing(true);
    const getToken = () => useSessionStore.getState().accessToken;
    await retryFailedTransactions(getToken);
    await refreshCounts();
    setSyncing(false);
  };

  const handleSelectOngoing = (entry: QueueEntry) => {
    reset();
    setQueueEntryId(entry.id);

    const items = entry.services ?? entry.booking?.items?.map((i) => ({ service: i.service })) ?? [];
    for (const item of items) {
      addItem({
        serviceId: undefined,
        name: item.service.name,
        unitPrice: item.service.basePrice,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Point of Sale</h1>
            <p className="text-xs text-slate-400">Process customer transactions</p>
          </div>
        </div>

        <BranchSelector />

        <div className="ml-auto flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <Wifi className="h-3 w-3" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing || !isOnline}
              className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : `${pendingCount} pending`}
            </button>
          )}
          {failedCount > 0 && (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={syncing || !isOnline}
              className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <AlertTriangle className="h-3 w-3" />
              {syncing ? "Retrying..." : `${failedCount} failed`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Ongoing Transactions Sidebar */}
        <div className="xl:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-800">Pending Checkouts</h2>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Select a completed service to auto-fill the POS
            </p>
            {selectedBranchId && (
              <OngoingTransactions
                branchId={selectedBranchId}
                onSelect={handleSelectOngoing}
              />
            )}
          </div>
        </div>

        {/* POS Checkout */}
        <div className="xl:col-span-3">
          <POSCheckout />
        </div>
      </div>
    </div>
  );
}
