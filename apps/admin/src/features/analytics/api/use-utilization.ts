import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type UtilizationBarber = {
  staffProfileId: string;
  name: string;
  availableMinutes: number;
  busyMinutes: number;
  servicesCount: number;
  utilizationRate: number;
};

export type UtilizationData = {
  overallRate: number;
  totalAvailableMinutes: number;
  totalBusyMinutes: number;
  barbers: UtilizationBarber[];
};

export function useUtilization(opts: { branchId?: string; dateFrom: string; dateTo: string }) {
  const params = new URLSearchParams({ dateFrom: opts.dateFrom, dateTo: opts.dateTo });
  if (opts.branchId) params.set("branchId", opts.branchId);

  return useQuery({
    queryKey: ["analytics", "utilization", opts],
    queryFn: () => api.get<ApiResponse<UtilizationData>>(`/analytics/utilization?${params}`),
  });
}
