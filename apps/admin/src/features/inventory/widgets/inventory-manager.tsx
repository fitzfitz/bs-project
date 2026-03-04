import { useBranchInventory } from "../api/use-branch-inventory";

type InventoryItem = {
  id: string;
  productId: string;
  quantity: number;
  reorderThreshold: number;
  product?: { name: string; sku: string };
};

export function InventoryManager({ branchId }: { branchId: string }) {
  const { data, isLoading, error } = useBranchInventory(branchId);

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
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No inventory items found
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const low = row.quantity <= row.reorderThreshold;
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-700">{row.product?.name ?? row.productId}</td>
                    <td className="px-3 py-2 text-slate-600">{row.product?.sku ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.reorderThreshold}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${low ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {low ? "Low Stock" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
