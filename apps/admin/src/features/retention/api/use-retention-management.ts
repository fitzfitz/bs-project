import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type RetentionStats = {
  totalNudges: number;
  last30Days: number;
};

export type TriggerResult = {
  atRiskSent: number;
  expirySent: number;
};

export function useRetentionStats() {
  return useQuery({
    queryKey: ["retention", "stats"],
    queryFn: () =>
      api.get<ApiResponse<RetentionStats>>("/retention/stats"),
  });
}

export function useTriggerRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ApiResponse<TriggerResult>>("/retention/trigger"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retention"] });
    },
  });
}
