import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type Summary = {
  count: number;
  totalRevenue: number;
  totalServiceRevenue: number;
  totalProductRevenue: number;
  totalTips: number;
  paymentMethods: Record<string, number>;
};

export function useDailySummary(branchId: string, date: string) {
  return useQuery({
    queryKey: ["transactions", "summary", branchId, date],
    queryFn: () => api.get<ApiResponse<Summary>>(`/transactions/summary?branchId=${branchId}&date=${date}`),
    enabled: !!branchId,
  });
}
