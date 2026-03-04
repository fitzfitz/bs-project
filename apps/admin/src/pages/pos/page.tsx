import { POSCheckout } from "@/features/pos/widgets/pos-checkout";
import { BranchSelector } from "@/components/branch-selector";

export default function POSPage() {
  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">POS Checkout</h1>
        <BranchSelector />
      </div>
      <div className="mt-4">
        <POSCheckout />
      </div>
    </div>
  );
}
