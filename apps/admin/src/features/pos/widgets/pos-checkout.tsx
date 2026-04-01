import { useState, useEffect, useMemo } from "react";
import { usePOSStore } from "../store/use-pos-store";
import { useServices } from "../api/use-services";
import { useBranches } from "../api/use-branches";
import { useProducts } from "@/features/inventory/api/use-products";
import { useCreateTransaction } from "../api/use-create-transaction";
import { useAddPayments } from "../api/use-add-payments";
import { useConfig } from "@/features/config/api/use-config";
import { saveOfflineTransaction } from "@/lib/offline-store";
import { syncPendingTransactions } from "@/lib/sync-pending";
import { useSessionStore } from "@/features/auth/store";
import { formatCurrency } from "@/lib/utils";
import { useBranchStore } from "@/store/use-branch-store";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  CheckCircle2,
  WifiOff,
  Package,
  Scissors,
  Tag,
  Receipt,
} from "lucide-react";

type ProductItem = {
  id: string;
  name: string;
  sellPrice: number;
  isActive: boolean;
  inventory?: Array<{ quantity: number }>;
};

const PAYMENT_METHODS = [
  { key: "CASH" as const, label: "Cash", icon: Banknote },
  { key: "QRIS" as const, label: "QRIS", icon: QrCode },
  { key: "CARD" as const, label: "Card", icon: CreditCard },
  { key: "DIGITAL_WALLET" as const, label: "E-Wallet", icon: Wallet },
];

export function POSCheckout() {
  const org = useSessionStore((s) => s.user?.organization);
  const { data: servicesData, isLoading: servicesLoading, error: servicesError } = useServices();
  const { data: branchesData, error: branchesError } = useBranches();
  const createTx = useCreateTransaction();
  const addPayments = useAddPayments();
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);
  const { data: configData } = useConfig();
  const taxRatePercent = Number(configData?.data?.TAX_RATE?.value ?? "12");
  const TAX_RATE = taxRatePercent / 100;
  const { data: productsData, isLoading: productsLoading } = useProducts(selectedBranchId ?? undefined);
  const [catalogTab, setCatalogTab] = useState<"services" | "products">("services");

  const cartItems = usePOSStore((s) => s.cartItems);
  const discountValue = usePOSStore((s) => s.discountValue);
  const tipAmount = usePOSStore((s) => s.tipAmount);
  const selectedPaymentMethod = usePOSStore((s) => s.selectedPaymentMethod);
  const queueEntryId = usePOSStore((s) => s.queueEntryId);
  const pendingTransactionId = usePOSStore((s) => s.pendingTransactionId);
  const pendingTransactionTotal = usePOSStore((s) => s.pendingTransactionTotal);
  const addItem = usePOSStore((s) => s.addItem);
  const removeItem = usePOSStore((s) => s.removeItem);
  const updateQuantity = usePOSStore((s) => s.updateQuantity);
  const setDiscount = usePOSStore((s) => s.setDiscount);
  const setTip = usePOSStore((s) => s.setTip);
  const setPaymentMethod = usePOSStore((s) => s.setPaymentMethod);
  const reset = usePOSStore((s) => s.reset);

  const [completedTxId, setCompletedTxId] = useState<string | null>(null);
  const branches = useMemo(() => branchesData?.data ?? [], [branchesData?.data]);

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
    if (!selectedPaymentMethod) return;

    // Retry flow: pending transaction already exists on server
    if (pendingTransactionId && pendingTransactionTotal != null) {
      try {
        await addPayments.mutateAsync({
          id: pendingTransactionId,
          payload: { payments: [{ method: selectedPaymentMethod, amount: pendingTransactionTotal }] },
        });
        setCompletedTxId(pendingTransactionId);
        reset();
      } catch (e) {
        console.error(e);
      }
      return;
    }

    if (!branchId || grandTotal <= 0) return;
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
      const serverTotal = createRes.data.totalDue ?? grandTotal;
      await addPayments.mutateAsync({
        id: txId,
        payload: { payments: [{ method: selectedPaymentMethod, amount: serverTotal }] },
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isOffline ? "bg-amber-50" : "bg-emerald-50"} mb-4`}>
          {isOffline ? (
            <WifiOff className="h-8 w-8 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          )}
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          {isOffline ? "Saved for Sync" : "Payment Complete"}
        </h3>
        <p className="mt-1 text-sm text-slate-500 max-w-xs">
          {isOffline
            ? "Transaction saved offline. It will automatically sync when you're back online."
            : `Transaction ${completedTxId.slice(0, 12)}... has been completed successfully.`}
        </p>
        <button
          type="button"
          onClick={() => setCompletedTxId(null)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
        >
          <Receipt className="h-4 w-4" />
          New Sale
        </button>
      </div>
    );
  }

  const services = servicesData?.data ?? [];
  const products = ((productsData?.data ?? []) as ProductItem[]).filter((p) => p.isActive);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Catalog Panel */}
      <div className="lg:col-span-3 space-y-4">
        {(servicesError || branchesError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {servicesError?.message || branchesError?.message}
          </div>
        )}

        {/* Catalog Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setCatalogTab("services")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              catalogTab === "services"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Scissors className="h-4 w-4" />
            Services
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab("products")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              catalogTab === "products"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Package className="h-4 w-4" />
            Products
          </button>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {catalogTab === "services" ? (
            servicesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
              ))
            ) : (
              services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addItem({ serviceId: s.id, name: s.name, unitPrice: s.basePrice })}
                  className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98]"
                >
                  <span className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors line-clamp-1">
                    {s.name}
                  </span>
                  <span className="mt-auto pt-1 text-xs font-bold text-primary">
                    {formatCurrency(s.basePrice, org?.currency, org?.locale)}
                  </span>
                </button>
              ))
            )
          ) : productsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center py-8 text-slate-400">
              <Package className="h-8 w-8 mb-2" />
              <p className="text-sm">No products available</p>
            </div>
          ) : (
            products.map((p) => {
              const stock = p.inventory?.[0]?.quantity ?? 0;
              const outOfStock = stock <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem({ productId: p.id, name: p.name, unitPrice: p.sellPrice })}
                  disabled={outOfStock}
                  className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:shadow-none"
                >
                  <span className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors line-clamp-1">
                    {p.name}
                  </span>
                  <div className="mt-auto pt-1 flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-primary">
                      {formatCurrency(p.sellPrice, org?.currency, org?.locale)}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${outOfStock ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
                      {outOfStock ? "Out" : `${stock} left`}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Order Panel */}
      <div className="lg:col-span-2">
        <div className="sticky top-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Cart Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <ShoppingCart className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-800">Current Order</h2>
            {cartItems.length > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                {cartItems.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </div>

          {/* Cart Items */}
          <div className="max-h-[280px] overflow-y-auto">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Add items to get started</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {cartItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(item.unitPrice, org?.currency, org?.locale)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(i, item.qty - 1)}
                        disabled={item.qty <= 1}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-slate-700">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(i, item.qty + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold text-slate-700">
                      {formatCurrency(
                        item.unitPrice * item.qty - item.discount,
                        org?.currency,
                        org?.locale,
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Order Summary */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-700">{formatCurrency(subtotal, org?.currency, org?.locale)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm text-slate-500">Discount</span>
              <input
                type="number"
                value={discountValue || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0"
                className="ml-auto w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-right text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tax ({taxRatePercent}%)</span>
              <span className="font-medium text-slate-700">
                {formatCurrency(tax, org?.currency, org?.locale)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Tip</span>
              <input
                type="number"
                value={tipAmount || ""}
                onChange={(e) => setTip(Number(e.target.value) || 0)}
                placeholder="0"
                className="ml-auto w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-right text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-base font-bold text-slate-800">Total</span>
              <span className="text-lg font-black text-primary">{formatCurrency(grandTotal, org?.currency, org?.locale)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">Payment Method</p>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition-all ${
                    selectedPaymentMethod === key
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30 shadow-sm"
                      : "border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Checkout Button */}
          <div className="px-5 pb-5 pt-1">
            {pendingTransactionId && (
              <p className="mb-2 text-center text-xs font-medium text-amber-600">
                Completing pending transaction {pendingTransactionId.slice(0, 12)}...
              </p>
            )}
            <button
              type="button"
              onClick={handleComplete}
              disabled={
                (!pendingTransactionId && cartItems.length === 0) ||
                !selectedPaymentMethod ||
                createTx.isPending ||
                addPayments.isPending
              }
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
            >
              {createTx.isPending || addPayments.isPending
                ? "Processing..."
                : pendingTransactionId
                  ? `Pay — ${formatCurrency(pendingTransactionTotal ?? 0, org?.currency, org?.locale)}`
                  : `Complete — ${formatCurrency(grandTotal, org?.currency, org?.locale)}`}
            </button>
            {(createTx.error || addPayments.error) && (
              <p className="mt-2 text-center text-xs text-red-500">
                {(createTx.error || addPayments.error)?.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
