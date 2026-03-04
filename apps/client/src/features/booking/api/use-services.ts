import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { ServiceResponse } from "../types";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ServiceResponse[]>>(
        "/services?limit=100"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
