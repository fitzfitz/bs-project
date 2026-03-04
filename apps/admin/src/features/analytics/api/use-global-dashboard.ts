import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useGlobalDashboard(date?: string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  return useQuery({
    queryKey: ["analytics", "dashboard", date],
    queryFn: () => api.get<ApiResponse<unknown>>(`/analytics/dashboard?${params}`),
    refetchInterval: 60_000,
  });
}
