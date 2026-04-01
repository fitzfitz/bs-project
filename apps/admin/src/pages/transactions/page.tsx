import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useBranchStore } from "@/store/use-branch-store";
import { useBranches } from "@/features/pos/api/use-branches";
import { BranchSelector } from "@/components/branch-selector";
import {
  useTransactions,
  useTransaction,
  useVoidTransaction,
  useRefundTransaction,
  type TransactionRow,
} from "@/features/transactions/api/use-transactions";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

const STATUS_OPTIONS = ["", "PENDING", "COMPLETED", "VOIDED", "REFUNDED"] as const;
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  VOIDED: "bg-red-100 text-red-800",
  REFUNDED: "bg-blue-100 text-blue-800",
};

export default function TransactionsPage() {
  const org = useSessionStore((s) => s.user?.organization);
  const { t } = useTranslation();
  const { data: branchesData } = useBranches();
  const branches = branchesData?.data ?? [];
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  if (!selectedBranchId && branches.length > 0) {
    setSelectedBranchId(branches[0].id);
  }

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const branchId = selectedBranchId ?? "";

  const { data, isLoading } = useTransactions({
    branchId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: statusFilter || undefined,
    page,
    limit: 20,
  });

  const { data: detailData } = useTransaction(selectedId);
  const voidMutation = useVoidTransaction();
  const refundMutation = useRefundTransaction();

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;
  const detail = detailData?.data;

  const handleVoid = async () => {
    if (!selectedId || voidReason.length < 5) return;
    await voidMutation.mutateAsync({ id: selectedId, reason: voidReason });
    setVoidReason("");
    setSelectedId(null);
  };

  const handleRefund = async () => {
    if (!selectedId || refundReason.length < 5) return;
    await refundMutation.mutateAsync({ id: selectedId, reason: refundReason });
    setRefundReason("");
    setSelectedId(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("transactions:title")}
        actions={<BranchSelector />}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded border px-2 py-1 text-sm"
          placeholder="From"
        />
        <span className="text-muted-foreground text-sm">{t("common:to")}</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="rounded border px-2 py-1 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded border px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Barber</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No transactions found.</td></tr>
              ) : transactions.map((tx: TransactionRow) => (
                <tr key={tx.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-3 py-2">
                    {tx.queueEntry?.customerName?.trim()
                      ? tx.queueEntry.customerName
                      : tx.customer
                        ? `${tx.customer.firstName} ${tx.customer.lastName}`
                        : tx.customerId
                          ? tx.customerId.slice(0, 8)
                          : "Walk-in"}
                  </td>
                  <td className="px-3 py-2">
                    {tx.staffProfile
                      ? `${tx.staffProfile.user?.firstName ?? ""} ${tx.staffProfile.user?.lastName ?? ""}`.trim() || "—"
                      : tx.staffProfileId
                        ? tx.staffProfileId.slice(0, 8)
                        : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(tx.totalDue ?? 0, org?.currency, org?.locale)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[tx.status] ?? ""}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(tx.id)}
                      className="text-primary text-xs hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedId && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedId(null)}>
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Transaction Detail</h2>
              <button type="button" onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detail.status] ?? ""}`}>{detail.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(detail.createdAt).toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grand Total</span>
                <span className="font-semibold">
                  {formatCurrency(detail.totalDue ?? 0, org?.currency, org?.locale)}
                </span>
              </div>

              {detail.items && detail.items.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Items</p>
                  <ul className="space-y-1 pl-2">
                    {detail.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.name} x{item.quantity}</span>
                        <span>
                          {formatCurrency(
                            item.unitPrice * item.quantity - item.discount,
                            org?.currency,
                            org?.locale,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.payments && detail.payments.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Payments</p>
                  <ul className="space-y-1 pl-2">
                    {detail.payments.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{p.method}</span>
                        <span>{formatCurrency(p.amount, org?.currency, org?.locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.status === "COMPLETED" && (
                <div className="border-t pt-3 mt-3 space-y-4">
                  <div>
                    <p className="font-medium mb-2">Void this transaction</p>
                    <input
                      type="text"
                      placeholder="Reason (min 5 chars)"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className="w-full rounded border px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleVoid}
                      disabled={voidReason.length < 5 || voidMutation.isPending}
                      className="mt-2 rounded bg-destructive px-4 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {voidMutation.isPending ? "Voiding..." : "Void Transaction"}
                    </button>
                  </div>

                  <div>
                    <p className="font-medium mb-2">Refund this transaction</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Reverses inventory stock and loyalty points.
                    </p>
                    <input
                      type="text"
                      placeholder="Reason (min 5 chars)"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full rounded border border-blue-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={handleRefund}
                      disabled={refundReason.length < 5 || refundMutation.isPending}
                      className="mt-2 rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50 hover:bg-blue-700"
                    >
                      {refundMutation.isPending ? "Refunding..." : "Refund Transaction"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
