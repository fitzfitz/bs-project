import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

type Branch = { id: string; name: string };

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Branch[]>>("/branches"),
  });
}
