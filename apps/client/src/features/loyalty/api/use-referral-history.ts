import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";
import type { ReferralHistoryItem } from "../types";

export function useReferralHistory(page = 1, limit = 20) {
  const user = useSessionStore((s) => s.user);
  return useQuery({
    queryKey: ["referrals", "history", user?.id, page, limit],
    queryFn: () =>
      api.get<ApiResponse<ReferralHistoryItem[]>>(
        `/referrals/me/history?page=${page}&limit=${limit}`,
      ),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}
