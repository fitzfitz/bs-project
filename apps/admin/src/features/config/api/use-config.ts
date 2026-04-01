import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type ConfigEntry = {
  value: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type ConfigMap = Record<string, ConfigEntry>;

export type ConfigUpdateResponse = {
  key: string;
  value: string;
  updatedBy: string | null;
  updatedAt: string;
};

export function useConfig() {
  return useQuery({
    queryKey: ["platform-config"],
    queryFn: () => api.get<ApiResponse<ConfigMap>>("/config"),
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.patch<ApiResponse<ConfigUpdateResponse>>(`/config/${key}`, { value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-config"] });
    },
  });
}
