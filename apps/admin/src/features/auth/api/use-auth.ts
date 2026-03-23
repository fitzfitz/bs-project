import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useSessionStore } from "@/features/auth/store";
import type { LoginResponse } from "../types";

export function useLogin() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post<LoginResponse>("/auth/login", credentials),
    onSuccess: (data) => {
      setSession(
        {
          id: data.data.user.id,
          email: data.data.user.email,
          firstName: data.data.user.firstName,
          lastName: data.data.user.lastName,
          tenantRoleId: data.data.user.tenantRoleId,
          tenantRole: data.data.user.tenantRole ?? null,
          staffProfile: data.data.user.staffProfile ?? null,
          isCustomer: data.data.user.isCustomer,
          permissions: data.data.user.permissions,
        },
        data.data.accessToken,
        data.data.refreshToken
      );
      navigate("/");
    },
  });
}
