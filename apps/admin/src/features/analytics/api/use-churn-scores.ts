import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";

export type ChurnItem = {
  customerId: string;
  customerName: string;
  customerEmail: string;
  score: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  features: {
    recencyDays: number;
    recencyScore: number;
    frequencyScore: number;
    recentVisits: number;
    monetaryScore: number;
    monetaryTrend: number;
    engagementScore: number;
  };
  computedAt: string;
};

export type ChurnScoresResult = {
  data: ChurnItem[];
  pagination?: PaginationResponse;
};

export function useChurnScores(branchId: string | null, opts?: { riskLevel?: string; page?: number }) {
  return useQuery({
    queryKey: ["churn-scores", branchId, opts?.riskLevel, opts?.page],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: branchId!, page: String(opts?.page ?? 1), limit: "20" });
      if (opts?.riskLevel) params.set("riskLevel", opts.riskLevel);
      const res = await api.get<ApiResponse<ChurnItem[]>>(`/analytics/churn-scores?${params}`);
      return { data: res.data, pagination: res.pagination } satisfies ChurnScoresResult;
    },
    enabled: !!branchId,
  });
}

export function useComputeChurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      api.post<ApiResponse<unknown>>("/analytics/churn-scores/compute", { branchId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["churn-scores"] }),
  });
}
