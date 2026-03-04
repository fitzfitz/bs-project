import { useState } from "react";
import { useBranchStore } from "@/store/use-branch-store";
import { BranchSelector } from "@/components/branch-selector";
import {
  useCurrentSession,
  useOpenSession,
  useCloseSession,
  useAddEntry,
  type CashDrawerSession,
  type CashDrawerEntry,
} from "@/features/cash-drawer/api/use-cash-drawer";
import { DollarSign } from "lucide-react";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  SALE: "Sale",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
  FLOAT: "Float",
};

export default function CashDrawerPage() {
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";
  const { data, isLoading } = useCurrentSession(branchId || null);
  const openMutation = useOpenSession();
  const closeMutation = useCloseSession();
  const addEntryMutation = useAddEntry();

  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [addType, setAddType] = useState<"SALE" | "REFUND" | "ADJUSTMENT" | "FLOAT">("SALE");
  const [addAmount, setAddAmount] = useState("");
  const [addReference, setAddReference] = useState("");
  const [closedSummary, setClosedSummary] = useState<CashDrawerSession | null>(null);

  const session = data?.data ?? null;

  const handleOpen = async () => {
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0 || !branchId) return;
    await openMutation.mutateAsync({ branchId, openingBalance: balance });
    setOpeningBalance("");
  };

  const handleClose = async () => {
    if (!session) return;
    const balance = parseFloat(closingBalance);
    if (isNaN(balance) || balance < 0) return;
    const result = await closeMutation.mutateAsync({
      sessionId: session.id,
      closingBalance: balance,
      notes: closeNotes || undefined,
    });
    setClosedSummary(result?.data ?? null);
    setClosingBalance("");
    setCloseNotes("");
  };

  const handleAddEntry = async () => {
    if (!session) return;
    const amount = parseFloat(addAmount);
    if (isNaN(amount)) return;
    await addEntryMutation.mutateAsync({
      sessionId: session.id,
      type: addType,
      amount,
      reference: addReference || undefined,
    });
    setAddAmount("");
    setAddReference("");
  };

  const runningTotal = session
    ? session.openingBalance +
      (session.entries ?? []).reduce((acc, e) => acc + e.amount, 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Cash Drawer</h1>
        <BranchSelector />
      </div>

      {!branchId ? (
        <p className="text-muted-foreground text-sm">Select a branch to continue.</p>
      ) : isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !session ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm max-w-md">
          <p className="text-muted-foreground mb-4">No cash drawer session is open.</p>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Opening Balance</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleOpen}
              disabled={
                openMutation.isPending ||
                !openingBalance ||
                parseFloat(openingBalance) < 0
              }
              className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <DollarSign className="h-4 w-4" />
              {openMutation.isPending ? "Opening..." : "Open Drawer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status card */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  OPEN
                </span>
                <p className="mt-1 text-sm text-muted-foreground">
                  Opened by{" "}
                  {session.openedBy
                    ? `${session.openedBy.firstName} ${session.openedBy.lastName}`
                    : "—"}{" "}
                  at {new Date(session.openedAt).toLocaleString("id-ID")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Running Total</p>
                <p className="text-2xl font-semibold">
                  {runningTotal.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          </div>

          {/* Add manual entry */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium mb-3">Add Manual Entry</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as typeof addType)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-sm"
                >
                  {(["SALE", "REFUND", "ADJUSTMENT", "FLOAT"] as const).map((t) => (
                    <option key={t} value={t}>
                      {ENTRY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-sm w-28"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Reference</label>
                <input
                  type="text"
                  value={addReference}
                  onChange={(e) => setAddReference(e.target.value)}
                  placeholder="Optional"
                  className="rounded border border-slate-200 px-3 py-1.5 text-sm w-40"
                />
              </div>
              <button
                type="button"
                onClick={handleAddEntry}
                disabled={addEntryMutation.isPending || !addAmount}
                className="rounded border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
              >
                {addEntryMutation.isPending ? "Adding..." : "Add Entry"}
              </button>
            </div>
          </div>

          {/* Entries list */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-muted/50 px-4 py-2">
              <h2 className="text-sm font-medium">Entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-left font-medium">Reference</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(session.entries ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No entries yet.
                      </td>
                    </tr>
                  ) : (
                    (session.entries ?? []).map((e: CashDrawerEntry) => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleTimeString("id-ID")}
                        </td>
                        <td className="px-4 py-2">{ENTRY_TYPE_LABELS[e.type] ?? e.type}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {e.reference ?? "—"}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            e.amount >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {e.amount >= 0 ? "+" : ""}
                          {e.amount.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Close drawer */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium mb-3">Close Drawer</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Closing Balance (actual count)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-sm w-40"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={
                  closeMutation.isPending ||
                  !closingBalance ||
                  parseFloat(closingBalance) < 0
                }
                className="rounded bg-destructive px-4 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {closeMutation.isPending ? "Closing..." : "Close Drawer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closed summary modal */}
      {closedSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setClosedSummary(null)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Session Closed</h2>
              <button
                type="button"
                onClick={() => setClosedSummary(null)}
                className="text-muted-foreground hover:text-foreground text-lg"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Balance</span>
                <span className="font-medium">
                  {(closedSummary.expectedBalance ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual (Closing)</span>
                <span className="font-medium">
                  {(closedSummary.closingBalance ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground">Discrepancy</span>
                <span
                  className={`font-semibold ${
                    (closedSummary.discrepancy ?? 0) >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {(closedSummary.discrepancy ?? 0) >= 0 ? "+" : ""}
                  {(closedSummary.discrepancy ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setClosedSummary(null)}
              className="mt-4 w-full rounded bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
