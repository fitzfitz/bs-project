import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function usePayrollPeriods(params: { staffProfileId?: string; status?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.staffProfileId) search.set("staffProfileId", params.staffProfileId);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  return useQuery({
    queryKey: ["payroll", params],
    queryFn: () => api.get<ApiResponse<unknown[]>>(`/payroll?${search}`),
  });
}
