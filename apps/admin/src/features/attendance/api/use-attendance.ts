import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type AttendanceRecord = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  branchId: string;
  notes: string | null;
  staff?: { id: string; user: { firstName: string; lastName: string } } | null;
  branch?: { name: string } | null;
};

export type ShiftBlock = {
  id: string;
  staffProfileId: string;
  branchId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  staff?: { user: { firstName: string; lastName: string } } | null;
};

type AttendanceParams = {
  branchId?: string;
  staffProfileId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
};

export function useAttendance(params: AttendanceParams = {}) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.staffProfileId) search.set("staffProfileId", params.staffProfileId);
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.page) search.set("page", String(params.page));
  return useQuery({
    queryKey: ["attendance", params],
    queryFn: () => api.get<ApiResponse<AttendanceRecord[]>>(`/attendance?${search}`),
    enabled: !!params.branchId || !!params.staffProfileId,
  });
}

export function useShifts(params: { branchId?: string; staffProfileId?: string; date?: string }) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.staffProfileId) search.set("staffProfileId", params.staffProfileId);
  if (params.date) search.set("date", params.date);
  return useQuery({
    queryKey: ["shifts", params],
    queryFn: () => api.get<ApiResponse<ShiftBlock[]>>(`/attendance/shifts?${search}`),
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { staffProfileId: string; branchId?: string; date: string; startTime: string; endTime: string; notes?: string }) =>
      api.post<ApiResponse<ShiftBlock>>("/attendance/shifts", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; staffProfileId?: string; branchId?: string; date?: string; startTime?: string; endTime?: string; notes?: string }) =>
      api.patch<ApiResponse<ShiftBlock>>(`/attendance/shifts/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<unknown>>(`/attendance/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}
