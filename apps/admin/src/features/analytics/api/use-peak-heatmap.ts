import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function usePeakHeatmap(params: { branchId?: string; dateFrom: string; dateTo: string }) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  search.set("dateFrom", params.dateFrom);
  search.set("dateTo", params.dateTo);
  return useQuery({
    queryKey: ["analytics", "heatmap", params],
    queryFn: () => api.get<ApiResponse<unknown>>(`/analytics/heatmap?${search}`),
  });
}
