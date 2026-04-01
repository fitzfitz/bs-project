import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { POSCheckout } from "@/features/pos/widgets/pos-checkout";
import { BranchSelector } from "@/components/branch-selector";
import { getOfflineCounts, cleanupSynced } from "@/lib/offline-store";
import { syncPendingTransactions, retryFailedTransactions } from "@/lib/sync-pending";
import { useSessionStore } from "@/features/auth/store";
import { formatCurrency } from "@/lib/utils";
import { useQueue, type QueueEntry } from "@/features/queue/api/use-queue";
import { useTransactions, type TransactionRow } from "@/features/transactions/api/use-transactions";
import { useBranchStore } from "@/store/use-branch-store";
import { usePOSStore } from "@/features/pos/store/use-pos-store";
import {
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  User,
  ChevronRight,
  ChevronDown,
  Scissors,
  Receipt,
  DollarSign,
} from "lucide-react";

function OngoingTransactions({
  branchId,
  onSelect,
}: {
  branchId: string;
  onSelect: (entry: QueueEntry) => void;
}) {
  const { t } = useTranslation();
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
        <p className="text-xs">{t("pos:noPendingCheckouts")}</p>
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
                  {entry.status === "AT_CHECKOUT" ? t("pos:statusCheckout") : t("pos:statusDone")}
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

function PendingTransactions({
  branchId,
  onSelect,
}: {
  branchId: string;
  onSelect: (tx: TransactionRow) => void;
}) {
  const org = useSessionStore((s) => s.user?.organization);
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useTransactions({
    branchId,
    dateFrom: today,
    status: "PENDING",
    limit: 20,
  });

  const pending = Array.isArray(data?.data) ? data.data : [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center py-4 text-center text-slate-400">
        <Receipt className="h-5 w-5 mb-1.5 opacity-50" />
        <p className="text-xs">{t("pos:noUnpaidTransactions")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.map((tx) => {
        const time = new Date(tx.createdAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <button
            key={tx.id}
            type="button"
            onClick={() => onSelect(tx)}
            className="group w-full flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {formatCurrency(tx.totalDue ?? 0, org?.currency, org?.locale)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {t("pos:labelUnpaid")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {time} · {tx.id.slice(0, 12)}...
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
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [checkoutsOpen, setCheckoutsOpen] = useState(true);
  const [unpaidOpen, setUnpaidOpen] = useState(true);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const addItem = usePOSStore((s) => s.addItem);
  const setQueueEntryId = usePOSStore((s) => s.setQueueEntryId);
  const setPendingTransaction = usePOSStore((s) => s.setPendingTransaction);
  const reset = usePOSStore((s) => s.reset);

  const refreshCounts = useCallback(async () => {
    const counts = await getOfflineCounts();
    setPendingCount(counts.pending);
    setFailedCount(counts.failed);
  }, []);

  useEffect(() => {
    // Polling + IndexedDB: intentional mount refresh (updates counts via setState inside refreshCounts)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- offline queue counts need initial load with interval
    void refreshCounts();
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

  const handleSelectPending = (tx: TransactionRow) => {
    reset();
    setPendingTransaction(tx.id, tx.totalDue);
    if (tx.items) {
      for (const item of tx.items) {
        addItem({
          name: item.name,
          unitPrice: item.unitPrice,
          qty: item.quantity,
        });
      }
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("pos:title")}
        description={t("pos:pageSubtitle")}
        actions={
          <>
            <BranchSelector />
            {isOnline ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                <Wifi className="h-3 w-3" /> {t("pos:onlineStatus")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                <WifiOff className="h-3 w-3" /> {t("pos:offlineStatus")}
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
                {syncing ? t("pos:syncing") : t("pos:pendingCount", { count: pendingCount })}
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
                {syncing ? t("pos:retrying") : t("pos:failedCount", { count: failedCount })}
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="xl:col-span-1 space-y-3">
          {/* Pending Checkouts Accordion */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setCheckoutsOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <Clock className="h-4 w-4 text-slate-400 shrink-0" />
              <h2 className="flex-1 text-sm font-bold text-slate-800">{t("pos:pendingCheckoutsTitle")}</h2>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${checkoutsOpen ? "rotate-180" : ""}`} />
            </button>
            {checkoutsOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                <p className="text-xs text-slate-400 mb-3">
                  {t("pos:hintSelectCheckout")}
                </p>
                <div className="max-h-[280px] overflow-y-auto">
                  {selectedBranchId && (
                    <OngoingTransactions
                      branchId={selectedBranchId}
                      onSelect={handleSelectOngoing}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Unpaid Transactions Accordion */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setUnpaidOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-amber-50/50 transition-colors"
            >
              <DollarSign className="h-4 w-4 text-amber-500 shrink-0" />
              <h2 className="flex-1 text-sm font-bold text-slate-800">{t("pos:unpaidTransactionsTitle")}</h2>
              <ChevronDown className={`h-4 w-4 text-amber-400 transition-transform ${unpaidOpen ? "rotate-180" : ""}`} />
            </button>
            {unpaidOpen && (
              <div className="border-t border-amber-200/50 px-4 pb-4 pt-2">
                <p className="text-xs text-slate-400 mb-3">
                  {t("pos:hintSelectPayment")}
                </p>
                <div className="max-h-[280px] overflow-y-auto">
                  {selectedBranchId && (
                    <PendingTransactions
                      branchId={selectedBranchId}
                      onSelect={handleSelectPending}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* POS Checkout */}
        <div className="xl:col-span-3">
          <POSCheckout />
        </div>
      </div>
    </PageContainer>
  );
}
