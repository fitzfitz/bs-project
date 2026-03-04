import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BranchStoreState {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string) => void;
}

export const useBranchStore = create<BranchStoreState>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setSelectedBranchId: (id) => set({ selectedBranchId: id }),
    }),
    { name: "tmng-admin-branch" }
  )
);
