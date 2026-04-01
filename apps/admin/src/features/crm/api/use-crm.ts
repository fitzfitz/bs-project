import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";

export type CustomerInsights = {
  customerId: string;
  customerName: string;
  email: string;
  totalVisits: number;
  totalSpend: number;
  averageSpend: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  favoriteServices: string[];
  loyaltyTier: string;
  segment: string | null;
};

export type CrmSegment = {
  id: string;
  name: string;
  memberCount: number;
  isAutomatic: boolean;
};

export type CrmCustomersParams = {
  segment?: string;
  minVisits?: number;
  sortBy: "spend" | "visits" | "recency";
  page: number;
  limit: number;
};

export function useCrmCustomers(branchId: string, params: CrmCustomersParams) {
  const search = new URLSearchParams();
  search.set("branchId", branchId);
  search.set("sortBy", params.sortBy);
  search.set("page", String(params.page));
  search.set("limit", String(params.limit));
  if (params.segment) search.set("segment", params.segment);
  if (params.minVisits !== undefined) search.set("minVisits", String(params.minVisits));

  return useQuery({
    queryKey: ["crm-customers", branchId, params],
    queryFn: () =>
      api.get<ApiResponse<CustomerInsights[]> & { pagination: PaginationResponse }>(
        `/crm/customers?${search.toString()}`
      ),
    enabled: !!branchId,
  });
}

export function useCrmSegments(branchId: string) {
  return useQuery({
    queryKey: ["crm-segments", branchId],
    queryFn: () =>
      api.get<ApiResponse<CrmSegment[]>>(
        `/crm/segments?branchId=${encodeURIComponent(branchId)}`
      ),
    enabled: !!branchId,
  });
}

export function useCrmCustomer(customerId: string | null, branchId: string) {
  return useQuery({
    queryKey: ["crm-customer", customerId, branchId],
    queryFn: () =>
      api.get<ApiResponse<CustomerInsights>>(
        `/crm/customers/${customerId}?branchId=${encodeURIComponent(branchId)}`
      ),
    enabled: !!branchId && !!customerId,
  });
}

export type RecomputeSegmentsResult = {
  segmentsProcessed: number;
  totalAssigned: number;
};

export function useRecomputeCrmSegments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      api.post<ApiResponse<RecomputeSegmentsResult>>("/crm/segments/recompute", {
        branchId,
      }),
    onSuccess: (_data, branchId) => {
      void qc.invalidateQueries({ queryKey: ["crm-customers", branchId] });
      void qc.invalidateQueries({ queryKey: ["crm-segments", branchId] });
    },
  });
}
