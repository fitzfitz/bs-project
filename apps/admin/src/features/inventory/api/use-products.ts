import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useProducts(branchId?: string) {
  return useQuery({
    queryKey: ["inventory", "products", branchId],
    queryFn: () =>
      api.get<ApiResponse<unknown[]>>(`/inventory/products${branchId ? `?branchId=${branchId}` : ""}`),
  });
}
