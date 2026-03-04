import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";
import type { UserProfileResponse } from "../types";

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
      const res = await api.patch<ApiResponse<UserProfileResponse>>(
        "/auth/me",
        data
      );
      return res.data;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["profile"], updatedUser);
      if (user) {
        setUser({ ...user, ...updatedUser });
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
