import { InventoryManager } from "@/features/inventory/widgets/inventory-manager";
import { BranchSelector } from "@/components/branch-selector";
import { useBranchStore } from "@/store/use-branch-store";

export default function InventoryPage() {
  const branchId = useBranchStore((s) => s.selectedBranchId) ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <BranchSelector />
      </div>
      <InventoryManager branchId={branchId} />
    </div>
  );
}
