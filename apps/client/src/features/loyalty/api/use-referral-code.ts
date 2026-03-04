import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";

export function useReferralCode() {
  const user = useSessionStore((s) => s.user);
  return useQuery({
    queryKey: ["referrals", "code", user?.id],
    queryFn: () =>
      api.get<ApiResponse<{ referralCode: string }>>("/referrals/me/code"),
    enabled: !!user,
  });
}
