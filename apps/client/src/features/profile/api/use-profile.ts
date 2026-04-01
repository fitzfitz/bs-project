import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";
import type { UpdateProfileResponse, UserProfileResponse } from "../types";

export function useProfile() {
  const { user } = useSessionStore();
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserProfileResponse>>("/auth/me");
      return res.data;
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser, user } = useSessionStore();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      const res = await api.patch<ApiResponse<UpdateProfileResponse>>(
        "/auth/me",
        data
      );
      return res.data;
    },
    onSuccess: (patch) => {
      queryClient.setQueryData<UserProfileResponse>(["profile"], (prev) =>
        prev ? { ...prev, ...patch } : prev
      );
      if (user) {
        setUser({
          id: patch.id,
          email: patch.email,
          firstName: patch.firstName,
          lastName: patch.lastName,
          tenantRoleId: patch.tenantRoleId,
          tenantRole: user.tenantRole,
          isCustomer: patch.isCustomer,
        });
      }
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { clearSession } = useSessionStore();

  return useMutation({
    mutationFn: async () => {
      const res = await api.delete<ApiResponse<{ message: string }>>(
        "/auth/me",
        {
          data: { confirm: "DELETE" },
        }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.clear();
      clearSession();
    },
  });
}
