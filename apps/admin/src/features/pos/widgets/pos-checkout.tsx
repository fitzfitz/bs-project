import { useState, useEffect } from "react";
import { usePOSStore } from "../store/use-pos-store";
import { useServices } from "../api/use-services";
import { useBranches } from "../api/use-branches";
import { useCreateTransaction } from "../api/use-create-transaction";
import { useAddPayments } from "../api/use-add-payments";
import { TAX_RATE } from "@/config/constants";
import { saveOfflineTransaction } from "@/lib/offline-store";
import { syncPendingTransactions } from "@/lib/sync-pending";
import { useSessionStore } from "@/features/auth/store";
import { useBranchStore } from "@/store/use-branch-store";


export function POSCheckout() {
  const { data: servicesData, isLoading: servicesLoading, error: servicesError } = useServices();
  const { data: branchesData, error: branchesError } = useBranches();
  const createTx = useCreateTransaction();
  const addPayments = useAddPayments();
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  const cartItems = usePOSStore((s) => s.cartItems);
  const discountValue = usePOSStore((s) => s.discountValue);
  const tipAmount = usePOSStore((s) => s.tipAmount);
  const selectedPaymentMethod = usePOSStore((s) => s.selectedPaymentMethod);
  const queueEntryId = usePOSStore((s) => s.queueEntryId);
  const addItem = usePOSStore((s) => s.addItem);
  const removeItem = usePOSStore((s) => s.removeItem);
  const setDiscount = usePOSStore((s) => s.setDiscount);
  const setTip = usePOSStore((s) => s.setTip);
  const setPaymentMethod = usePOSStore((s) => s.setPaymentMethod);
  const reset = usePOSStore((s) => s.reset);

  const [completedTxId, setCompletedTxId] = useState<string | null>(null);
  const branches = branchesData?.data ?? [];

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedBranchId, branches, setSelectedBranchId]);

  const branchId = selectedBranchId ?? "";

  const subtotal = cartItems.reduce((s, i) => s + i.unitPrice * i.qty - i.discount, 0);
  const discountTotal = Math.min(discountValue, subtotal);
  const tax = (subtotal - discountTotal) * TAX_RATE;
  const grandTotal = subtotal - discountTotal + tax + tipAmount;

  const handleComplete = async () => {
    if (!branchId || !selectedPaymentMethod || grandTotal <= 0) return;
    const payload = {
      branchId,
      queueEntryId: queueEntryId ?? undefined,
      items: cartItems.map((i) => ({
        serviceId: i.serviceId,
        productId: i.productId,
        name: i.name,
        quantity: i.qty,
        unitPrice: i.unitPrice,
        discount: i.discount,
        isAddOn: false,
      })),
      tipAmount,
      discountAmount: discountTotal,
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const clientUuid = crypto.randomUUID();
      await saveOfflineTransaction({
        clientUuid,
        payload: { ...payload, clientUuid },
        status: "PENDING_SYNC",
        createdAt: Date.now(),
      });
      setCompletedTxId(`offline-${clientUuid}`);
      reset();
      return;
    }
    try {
      const createRes = await createTx.mutateAsync(payload);
      const txId = createRes.data.id;
      await addPayments.mutateAsync({
        id: txId,
        payload: { payments: [{ method: selectedPaymentMethod, amount: grandTotal }] },
      });
      setCompletedTxId(txId);
      reset();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => syncPendingTransactions(() => useSessionStore.getState().accessToken);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  if (completedTxId) {
    const isOffline = completedTxId.startsWith("offline-");
    return (
      <div className="rounded border p-4">
        <p className="font-medium">{isOffline ? "Saved for sync" : "Payment complete"}</p>
        <p className="text-sm text-muted-foreground">{isOffline ? "Will sync when online." : `Transaction ID: ${completedTxId}`}</p>
        <button
          type="button"
          onClick={() => setCompletedTxId(null)}
          className="mt-2 rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          New sale
        </button>
      </div>
    );
  }

  const services = servicesData?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <h2 className="mb-2 font-semibold">Services</h2>
        {servicesError && (
          <p className="text-sm text-destructive mb-2">Failed to load services: {servicesError.message}</p>
        )}
        {branchesError && (
          <p className="text-sm text-destructive mb-2">Failed to load branches: {branchesError.message}</p>
        )}
        {servicesLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-32 animate-pulse rounded border bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addItem({ serviceId: s.id, name: s.name, unitPrice: s.basePrice })}
                className="rounded border bg-card px-3 py-2 text-left text-sm shadow-sm hover:bg-muted"
              >
                {s.name} — {s.basePrice.toLocaleString("id-ID")}
              </button>
            ))}
          </div>
        )}
        <h2 className="mt-4 font-semibold">Cart</h2>
        <ul className="mt-2 space-y-1">
          {cartItems.map((item, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span>{item.name} × {item.qty}</span>
              <span>{((item.unitPrice * item.qty) - item.discount).toLocaleString("id-ID")}</span>
              <button type="button" onClick={() => removeItem(i)} className="text-destructive">×</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded border p-4">
        <h2 className="font-semibold">Order summary</h2>
        <p>Subtotal: {subtotal.toLocaleString("id-ID")}</p>
        <div className="mt-2">
          <label className="text-sm">Discount</label>
          <input
            type="number"
            value={discountValue || ""}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="ml-2 w-24 rounded border px-2 py-1"
          />
        </div>
        <p>Tax (12%): {tax.toLocaleString("id-ID")}</p>
        <div className="mt-2">
          <label className="text-sm">Tip</label>
          <input
            type="number"
            value={tipAmount || ""}
            onChange={(e) => setTip(Number(e.target.value) || 0)}
            className="ml-2 w-24 rounded border px-2 py-1"
          />
        </div>
        <p className="mt-2 font-semibold">Total: {grandTotal.toLocaleString("id-ID")}</p>
        <div className="mt-2 flex gap-2">
          {(["CASH", "QRIS", "CARD"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`rounded px-3 py-1 text-sm ${selectedPaymentMethod === m ? "bg-primary text-primary-foreground" : "border"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleComplete}
          disabled={cartItems.length === 0 || !selectedPaymentMethod || createTx.isPending || addPayments.isPending}
          className="mt-4 w-full rounded bg-primary py-2 text-primary-foreground disabled:opacity-50"
        >
          Complete checkout
        </button>
        {(createTx.error || addPayments.error) && (
          <p className="mt-2 text-sm text-destructive">
            {(createTx.error || addPayments.error)?.message}
          </p>
        )}
      </div>
    </div>
  );
}
