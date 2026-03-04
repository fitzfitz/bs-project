import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type Service = { id: string; name: string; basePrice: number; durationMinutes: number };

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => api.get<ApiResponse<Service[]>>("/services?limit=100"),
  });
}
