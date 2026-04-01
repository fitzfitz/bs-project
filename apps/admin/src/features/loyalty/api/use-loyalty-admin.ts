import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export interface CustomerMembership {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  tierMultiplier: number;
  lastActivityAt: string | null;
  pointsExpiringAt: string | null;
  user?: { firstName: string; lastName: string; email: string };
}

export interface ReferralItem {
  id: string;
  referrerId: string;
  refereeId: string;
  bonusPoints: number;
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  completedAt: string | null;
  createdAt: string;
  referee: { firstName: string; lastName: string; createdAt: string } | null;
}

export interface ReferralStats {
  total: number;
  completed: number;
  pending: number;
  conversionRate: number;
}

export function useCustomerMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-loyalty", userId],
    queryFn: () => api.get<ApiResponse<CustomerMembership>>(`/loyalty/${userId}`),
    enabled: !!userId,
  });
}

/** PATCH /loyalty/admin/adjust — API returns `{ success, message }` only (no `data`). */
export type AdjustPointsResponse = { success: true; message: string };

export function useAdjustPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; points: number; description: string }) =>
      api.patch<AdjustPointsResponse>("/loyalty/admin/adjust", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-loyalty"] });
    },
  });
}

export function useExpirePoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ApiResponse<{ accountsProcessed: number; totalExpired: number }>>("/loyalty/admin/expire"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-loyalty"] });
    },
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: ["admin-referral-stats"],
    queryFn: () => api.get<ApiResponse<ReferralStats>>("/referrals/stats"),
  });
}
