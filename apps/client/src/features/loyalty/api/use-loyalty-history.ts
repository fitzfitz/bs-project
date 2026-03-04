import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";
import type { LoyaltyTransaction } from "../types";

export function useLoyaltyHistory(page = 1, limit = 20) {
  const user = useSessionStore((s) => s.user);
  return useQuery({
    queryKey: ["loyalty", "history", user?.id, page, limit],
    queryFn: () =>
      api.get<ApiResponse<LoyaltyTransaction[]>>(
        `/loyalty/me/history?page=${page}&limit=${limit}`,
      ),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}
