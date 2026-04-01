import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";

export type StaffEarning = {
  id: string;
  staffProfileId: string;
  date: string;
  commissionBase: number;
  commission: number;
  tips: number;
  total: number;
  createdAt: string;
  staff: {
    id: string;
    user: { firstName: string; lastName: string };
  };
};

type PaginatedEarningsResponse = ApiResponse<StaffEarning[]> & {
  pagination: PaginationResponse;
};

export function useEarnings(params: { staffProfileId?: string; dateFrom?: string; dateTo?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.staffProfileId) search.set("staffProfileId", params.staffProfileId);
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.page) search.set("page", String(params.page));
  return useQuery({
    queryKey: ["commissions", params],
    queryFn: () => api.get<PaginatedEarningsResponse>(`/commissions?${search}`),
  });
}

/** For BARBER role: fetches own earnings via GET /commissions/me */
export function useMyEarnings(params: { dateFrom?: string; dateTo?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.page) search.set("page", String(params.page));
  return useQuery({
    queryKey: ["commissions", "me", params],
    queryFn: () => api.get<PaginatedEarningsResponse>(`/commissions/me?${search}`),
  });
}
