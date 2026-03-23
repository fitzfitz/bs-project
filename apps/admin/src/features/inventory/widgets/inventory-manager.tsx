import { useState } from "react";
import { useBranchInventory } from "../api/use-branch-inventory";
import { useStockIn, useStockOut, useAdjustStock } from "../api/use-stock-actions";

type InventoryItem = {
  id: string;
  productId: string;
  quantity: number;
  reorderThreshold: number;
  product?: { name: string; sku: string };
};

type StockAction = {
  type: "in" | "out" | "adjust";
  productId: string;
  productName: string;
  currentQty: number;
} | null;

function StockActionDialog({
  action,
  branchId,
  onClose,
}: {
  action: NonNullable<StockAction>;
  branchId: string;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [note, setNote] = useState("");
  const stockIn = useStockIn();
  const stockOut = useStockOut();
  const adjustStock = useAdjustStock();

  const isPending = stockIn.isPending || stockOut.isPending || adjustStock.isPending;

  const handleSubmit = async () => {
    if (action.type === "in") {
      await stockIn.mutateAsync({ branchId, productId: action.productId, quantity, costPerUnit, note: note || undefined });
    } else if (action.type === "out") {
      await stockOut.mutateAsync({ branchId, productId: action.productId, quantity, note: note || undefined });
    } else {
      await adjustStock.mutateAsync({ branchId, productId: action.productId, newQuantity: quantity, note });
    }
    onClose();
  };

  const title = action.type === "in" ? "Stock In" : action.type === "out" ? "Stock Out" : "Adjust Stock";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {action.productName} (current: {action.currentQty})
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">
              {action.type === "adjust" ? "New Quantity" : "Quantity"}
            </label>
            <input
              type="number"
              min={0}
              value={quantity || ""}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              autoFocus
            />
          </div>
          {action.type === "in" && (
            <div>
              <label className="text-sm font-medium">Cost Per Unit</label>
              <input
                type="number"
                min={0}
                value={costPerUnit || ""}
                onChange={(e) => setCostPerUnit(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Note {action.type === "adjust" && "(required)"}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for adjustment"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
        {(stockIn.error || stockOut.error || adjustStock.error) && (
          <p className="mt-2 text-sm text-destructive">
            {(stockIn.error || stockOut.error || adjustStock.error)?.message}
          </p>
        )}
        <div className="mt-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || quantity <= 0 || (action.type === "adjust" && !note)}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InventoryManager({ branchId }: { branchId: string }) {
  const { data, isLoading, error } = useBranchInventory(branchId);
  const [stockAction, setStockAction] = useState<StockAction>(null);

  if (!branchId) return <p className="text-muted-foreground py-8 text-center">No branch selected.</p>;
  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading...</p>;
  if (error) return <p className="text-destructive py-8 text-center">{error.message}</p>;

  const items = (data?.data ?? []) as InventoryItem[];

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Branch Inventory</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">SKU</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Qty</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Threshold</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No inventory items found
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const low = row.quantity <= row.reorderThreshold;
                const name = row.product?.name ?? row.productId;
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-700">{name}</td>
                    <td className="px-3 py-2 text-slate-600">{row.product?.sku ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.reorderThreshold}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${low ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {low ? "Low Stock" : "OK"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setStockAction({ type: "in", productId: row.productId, productName: name, currentQty: row.quantity })}
                          className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          +In
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockAction({ type: "out", productId: row.productId, productName: name, currentQty: row.quantity })}
                          className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          -Out
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockAction({ type: "adjust", productId: row.productId, productName: name, currentQty: row.quantity })}
                          className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {stockAction && (
        <StockActionDialog
          action={stockAction}
          branchId={branchId}
          onClose={() => setStockAction(null)}
        />
      )}
    </div>
  );
}
