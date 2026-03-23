import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "../store";


type AuthMeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantRoleId: string;
  tenantRole?: { name: string; scope: string } | null;
  staffProfile?: { id: string; tier: string } | null;
  isCustomer?: boolean;
  permissions?: Record<string, { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }>;
};

export function useAuthMe() {
  const hasToken = useSessionStore((s) => !!s.accessToken);
  const updateUser = useSessionStore((s) => s.updateUser);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AuthMeResponse>>("/auth/me");
      return res as ApiResponse<AuthMeResponse>;
    },
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
  });

  const userData = query.data?.data;

  useEffect(() => {
    if (userData) {
      updateUser({
        staffProfile: userData.staffProfile ?? null,
        tenantRole: userData.tenantRole ?? null,
        isCustomer: userData.isCustomer,
        permissions: userData.permissions,
      });
    }
  }, [userData, updateUser]);

  return query;
}
