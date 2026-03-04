import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useBranchComparison(params: { dateFrom: string; dateTo: string; metric: string; branchIds?: string[] }) {
  const search = new URLSearchParams();
  search.set("dateFrom", params.dateFrom);
  search.set("dateTo", params.dateTo);
  search.set("metric", params.metric);
  if (params.branchIds && params.branchIds.length > 0) search.set("branchIds", params.branchIds.join(","));
  return useQuery({
    queryKey: ["analytics", "comparison", params],
    queryFn: () => api.get<ApiResponse<unknown[]>>(`/analytics/comparison?${search}`),
  });
}
