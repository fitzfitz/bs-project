import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type Product = {
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
  inventory?: { id: string; branchId: string; quantity: number; reorderThreshold: number; avgCost: number }[];
};

export type UseProductsOptions = {
  limit?: number;
  page?: number;
};

export function useProducts(branchId?: string, options?: UseProductsOptions) {
  const limit = options?.limit;
  const page = options?.page;
  return useQuery({
    queryKey: ["inventory", "products", branchId, limit, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (limit != null) params.set("limit", String(limit));
      if (page != null) params.set("page", String(page));
      const q = params.toString();
      return api.get<ApiResponse<Product[]>>(`/inventory/products${q ? `?${q}` : ""}`);
    },
  });
}
