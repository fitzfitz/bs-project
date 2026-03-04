import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { BarberResponse } from "../types";

export function useBarbers(branchId?: string) {
  return useQuery({
    queryKey: ["barbers", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const res = await api.get<ApiResponse<BarberResponse[]>>(
        `/staff?branchId=${branchId}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!branchId,
  });
}
