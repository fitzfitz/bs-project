import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type BranchDashboardItem = {
  branchId: string;
  branchName: string;
  isOpen: boolean;
  revenue: number;
  transactionCount: number;
  activeBarbers: number;
  queueLength: number;
  avgRating: number;
};

export type GlobalDashboardTotals = {
  totalRevenue: number;
  totalTransactions: number;
  totalActiveBarbers: number;
  totalQueueEntries: number;
};

export type GlobalDashboardAlert = {
  type: string;
  branchId: string;
  branchName: string;
  message: string;
  severity: string;
  createdAt: string;
};

export type GlobalDashboardData = {
  date: string;
  branches: BranchDashboardItem[];
  totals: GlobalDashboardTotals;
  alerts: GlobalDashboardAlert[];
};

export function useGlobalDashboard(date?: string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  return useQuery({
    queryKey: ["analytics", "dashboard", date],
    queryFn: () => api.get<ApiResponse<GlobalDashboardData>>(`/analytics/dashboard?${params}`),
    refetchInterval: 60_000,
  });
}
