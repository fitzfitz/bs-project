import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useRetention(params: { branchId?: string; cohortMonth: string }) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  search.set("cohortMonth", params.cohortMonth);
  return useQuery({
    queryKey: ["analytics", "retention", params],
    queryFn: () => api.get<ApiResponse<unknown>>(`/analytics/retention?${search}`),
  });
}
