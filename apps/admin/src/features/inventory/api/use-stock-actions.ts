import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type StockInResult = { quantity: number; avgCost: number };
export type StockOutResult = { warning?: "LOW_STOCK"; product?: string; remaining?: number };
export type StockMovement = {
  id: string;
  productId: string;
  branchId: string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "VOID_REVERSAL";
  quantity: number;
  costPerUnit: number | null;
  note: string | null;
  createdAt: string;
};

export function useStockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: string; productId: string; quantity: number; costPerUnit: number; note?: string }) =>
      api.post<ApiResponse<StockInResult>>("/inventory/stock-in", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useStockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: string; productId: string; quantity: number; note?: string }) =>
      api.post<ApiResponse<StockOutResult>>("/inventory/stock-out", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: string; productId: string; newQuantity: number; note: string }) =>
      api.post<ApiResponse<{ quantity: number }>>("/inventory/adjust", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
