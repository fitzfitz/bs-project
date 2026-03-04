import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  isActive: boolean;
  isEmergencyClosed: boolean;
  tipDistribution?: "PER_STAFF" | "POOLED";
  operatingHours?: OperatingHour[];
  surgeRules?: SurgeRule[];
  holidays?: BranchHoliday[];
};

export type OperatingHour = {
  id: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export type SurgeRule = {
  id: string;
  name: string;
  dayOfWeek: string;
  startHour: number;
  endHour: number;
  multiplier: number;
  isActive: boolean;
};

export type BranchHoliday = {
  id: string;
  branchId: string;
  date: string;
  name: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export function useBranch(id: string) {
  return useQuery({
    queryKey: ["branch", id],
    queryFn: () => api.get<ApiResponse<Branch>>(`/branches/${id}`),
    enabled: !!id,
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; address?: string; city?: string; phone?: string; email?: string; latitude?: number; longitude?: number; imageUrl?: string; tipDistribution?: "PER_STAFF" | "POOLED" }) =>
      api.patch<ApiResponse<Branch>>(`/branches/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["branch", vars.id] });
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

type OperatingHourInput = {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export function useSetOperatingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hours }: { id: string; hours: OperatingHourInput[] }) =>
      api.put<ApiResponse<unknown>>(`/branches/${id}/operating-hours`, { hours }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["branch", vars.id] }),
  });
}

export function useCreateSurgeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, ...data }: { branchId: string; name: string; dayOfWeek: string; startHour: number; endHour: number; multiplier: number }) =>
      api.post<ApiResponse<SurgeRule>>(`/branches/${branchId}/surge-rules`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["branch", vars.branchId] }),
  });
}

export function useDeleteSurgeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, ruleId }: { branchId: string; ruleId: string }) =>
      api.delete<ApiResponse<unknown>>(`/branches/${branchId}/surge-rules/${ruleId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["branch", vars.branchId] }),
  });
}

export function useEmergencyClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      api.post<ApiResponse<unknown>>(`/branches/${branchId}/emergency-close`),
    onSuccess: (_, branchId) => {
      qc.invalidateQueries({ queryKey: ["branch", branchId] });
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

export function useReopenBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      api.post<ApiResponse<unknown>>(`/branches/${branchId}/reopen`),
    onSuccess: (_, branchId) => {
      qc.invalidateQueries({ queryKey: ["branch", branchId] });
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

export function useBranchHolidays(branchId: string) {
  return useQuery({
    queryKey: ["branch-holidays", branchId],
    queryFn: () => api.get<ApiResponse<BranchHoliday[]>>(`/branches/${branchId}/holidays`),
    enabled: !!branchId,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, ...data }: { branchId: string; date: string; name: string; isClosed?: boolean; openTime?: string | null; closeTime?: string | null }) =>
      api.post<ApiResponse<BranchHoliday>>(`/branches/${branchId}/holidays`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["branch-holidays", vars.branchId] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, holidayId }: { branchId: string; holidayId: string }) =>
      api.delete<ApiResponse<unknown>>(`/branches/${branchId}/holidays/${holidayId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["branch-holidays", vars.branchId] }),
  });
}
