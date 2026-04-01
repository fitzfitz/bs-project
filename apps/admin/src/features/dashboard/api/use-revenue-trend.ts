import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type RevenueTrendPoint = {
  date: string;
  revenue: number;
  transactions: number;
};

export function useRevenueTrend(branchId: string, days = 7) {
  const search = new URLSearchParams();
  if (branchId) search.set("branchId", branchId);
  search.set("days", String(days));
  return useQuery({
    queryKey: ["analytics", "revenue-trend", branchId, days],
    queryFn: () =>
      api.get<ApiResponse<RevenueTrendPoint[]>>(`/analytics/revenue-trend?${search}`),
    enabled: !!branchId,
  });
}
