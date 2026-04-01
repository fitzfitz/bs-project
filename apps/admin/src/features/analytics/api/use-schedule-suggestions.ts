import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type ScheduleSuggestion = {
  id: string;
  date: string;
  suggestedStart: string;
  suggestedEnd: string;
  reason: string;
  demandScore: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  staffProfileId: string | null;
};

export function useScheduleSuggestions(branchId: string | null, weekStart?: string) {
  return useQuery({
    queryKey: ["schedule-suggestions", branchId, weekStart],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: branchId! });
      if (weekStart) params.set("weekStart", weekStart);
      const res = await api.get<ApiResponse<ScheduleSuggestion[]>>(`/analytics/schedule-suggestions?${params}`);
      return res.data;
    },
    enabled: !!branchId,
  });
}

export function useComputeSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      api.post<ApiResponse<unknown>>("/analytics/schedule-suggestions/compute", { branchId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-suggestions"] }),
  });
}

export function useUpdateSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACCEPTED" | "REJECTED" }) =>
      api.patch<ApiResponse<unknown>>(`/analytics/schedule-suggestions/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-suggestions"] }),
  });
}
