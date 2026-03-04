import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";
import type { CustomerMembership } from "@/features/loyalty/types";

export type { CustomerMembership };

export function useLoyalty() {
  const { user } = useSessionStore();
  return useQuery({
    queryKey: ["loyalty", "account", user?.id],
    queryFn: () => api.get<ApiResponse<CustomerMembership>>("/loyalty/me"),
    enabled: !!user,
  });
}
