import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useBranchInventory(branchId: string) {
  return useQuery({
    queryKey: ["inventory", "branch", branchId],
    queryFn: () => api.get<ApiResponse<unknown[]>>(`/inventory/branches/${branchId}`),
    enabled: !!branchId,
  });
}
