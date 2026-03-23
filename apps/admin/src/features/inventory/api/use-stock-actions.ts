import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useStockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: string; productId: string; quantity: number; costPerUnit: number; note?: string }) =>
      api.post<ApiResponse<unknown>>("/inventory/stock-in", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useStockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: string; productId: string; quantity: number; note?: string }) =>
      api.post<ApiResponse<unknown>>("/inventory/stock-out", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: string; productId: string; newQuantity: number; note: string }) =>
      api.post<ApiResponse<unknown>>("/inventory/adjust", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
