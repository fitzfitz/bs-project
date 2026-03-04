import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type StaffProfile = {
  id: string;
  userId: string;
  bio: string | null;
  tier: "JUNIOR" | "SENIOR" | "MASTER";
  status: "AVAILABLE" | "BUSY" | "ON_BREAK" | "RESERVED" | "OFF_DUTY";
  specialties: string[];
  commissionModel: string;
  commissionRate: number;
  baseSalary: number;
  isActive: boolean;
  avatarUrl: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  branch?: { id: string; name: string };
};

type ListParams = {
  branchId?: string;
  tier?: string;
  page?: number;
};

export function useBarbers(params: ListParams = {}) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.tier) search.set("tier", params.tier);
  if (params.page) search.set("page", String(params.page));
  return useQuery({
    queryKey: ["barbers", params],
    queryFn: () => api.get<ApiResponse<StaffProfile[]>>(`/staff?${search}`),
  });
}

export function useBarber(id: string | null) {
  return useQuery({
    queryKey: ["barber", id],
    queryFn: () => api.get<ApiResponse<StaffProfile>>(`/staff/${id}`),
    enabled: !!id,
  });
}

type CreateInput = {
  userId: string;
  bio?: string;
  tier?: string;
  specialties?: string[];
  commissionModel?: string;
  commissionRate?: number;
  baseSalary?: number;
};

export function useCreateBarber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInput) => api.post<ApiResponse<StaffProfile>>("/staff", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers"] }),
  });
}

export function useUpdateBarber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: CreateInput & { id: string }) =>
      api.patch<ApiResponse<StaffProfile>>(`/staff/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers"] }),
  });
}

export function useDeleteBarber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<unknown>>(`/staff/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers"] }),
  });
}

export function useAssignBarberBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId, isPrimary }: { id: string; branchId: string; isPrimary?: boolean }) =>
      api.post<ApiResponse<unknown>>(`/staff/${id}/branches`, { branchId, isPrimary: isPrimary ?? true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers"] }),
  });
}

export function useUnassignBarberBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) =>
      api.delete<ApiResponse<unknown>>(`/staff/${id}/branches`, { data: { branchId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers"] }),
  });
}

export function useUpdateBarberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<ApiResponse<StaffProfile>>(`/staff/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers"] }),
  });
}
