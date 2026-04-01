import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type WaitlistEntry = {
  id: string;
  organizationId: string;
  branchId: string;
  userId: string;
  customerName: string;
  preferredDate: string;
  preferredTimeSlot: string;
  serviceIds: string[];
  staffProfileId: string | null;
  status: "WAITING" | "NOTIFIED" | "EXPIRED" | "CANCELLED";
  notifiedAt: string | null;
  expiresAt: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

export function useAdminWaitlist(branchId: string) {
  return useQuery({
    queryKey: ["admin-waitlist", branchId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<WaitlistEntry[]>>(`/waitlist/admin?branchId=${branchId}`);
      return res;
    },
    enabled: !!branchId,
  });
}
