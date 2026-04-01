import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Product } from "./use-products";

export type CreateProductInput = {
  name: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
};

export type UpdateProductInput = Partial<CreateProductInput>;

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductInput) =>
      api.post<ApiResponse<Product>>("/inventory/products", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProductInput & { id: string }) =>
      api.patch<ApiResponse<Product>>(`/inventory/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<Product>>(`/inventory/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
