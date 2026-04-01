import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type BranchInventoryItem = {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  reorderThreshold: number;
  avgCost: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    description: string | null;
    costPrice: number;
    sellPrice: number;
    imageUrl: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export function useBranchInventory(branchId: string) {
  return useQuery({
    queryKey: ["inventory", "branch", branchId],
    queryFn: () => api.get<ApiResponse<BranchInventoryItem[]>>(`/inventory/branches/${branchId}`),
    enabled: !!branchId,
  });
}
