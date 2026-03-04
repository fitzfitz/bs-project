import { useEffect, useMemo } from "react";
import { useBranches } from "@/features/pos/api/use-branches";
import { useBranchStore } from "@/store/use-branch-store";
import { useSessionStore } from "@/features/auth/store";

export function BranchSelector() {
  const { data, isLoading } = useBranches();
  const user = useSessionStore((s) => s.user);
  const branches = useMemo(() => data?.data ?? [], [data]);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  useEffect(() => {
    if (user?.tenantRole?.scope === "BRANCH" && user.branchId) {
      if (selectedBranchId !== user.branchId) {
        setSelectedBranchId(user.branchId);
      }
    } else if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedBranchId, branches, setSelectedBranchId, user]);

  if (isLoading) {
    return (
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
    );
  }

  if (branches.length === 0) return null;

  const selectedName = branches.find((b) => b.id === selectedBranchId)?.name;

  if (branches.length === 1 || user?.tenantRole?.scope === "BRANCH") {
    return (
      <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
        {selectedName ?? branches[0]?.name ?? "Branch"}
      </span>
    );
  }

  return (
    <select
      value={selectedBranchId ?? ""}
      onChange={(e) => setSelectedBranchId(e.target.value)}
      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
