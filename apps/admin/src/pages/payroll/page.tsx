import { useState } from "react";
import { PayrollManager } from "@/features/payroll/widgets/payroll-manager";
import { BranchSelector } from "@/components/branch-selector";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function PayrollPage() {
  const [page, setPage] = useState(1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <BranchSelector />
      </div>
      <PayrollManager page={page} />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
