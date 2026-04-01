import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse, type PaginationResponse } from "@/lib/api";

export type ServiceType = "STANDARD" | "COMBO" | "ADD_ON";

export type TierSurchargeRow = {
  id: string;
  serviceId: string;
  organizationId: string;
  tier: string;
  surcharge: number;
};

export type BranchOverrideRow = {
  id: string;
  branchId: string;
  serviceId: string;
  organizationId: string;
  overridePrice: number | null;
  isActive: boolean;
};

export type Service = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string;
  type: ServiceType;
  basePrice: number;
  durationMinutes: number;
  bufferMinutes: number;
  isCommissionable: boolean;
  loyaltyEligible: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  tierSurcharges: TierSurchargeRow[];
  comboChildren: Array<{
    id: string;
    comboId: string;
    childServiceId: string;
    organizationId: string;
    childService: {
      id: string;
      name: string;
      category: string;
      type: ServiceType;
      basePrice: number;
    };
  }>;
  branchOverrides: BranchOverrideRow[];
};

export type CreateServiceInput = {
  name: string;
  description?: string;
  category: string;
  type?: ServiceType;
  basePrice: number;
  durationMinutes: number;
  bufferMinutes?: number;
  isCommissionable?: boolean;
  loyaltyEligible?: boolean;
  sortOrder?: number;
};

export type UpdateServiceInput = Partial<CreateServiceInput>;

export type ListServicesParams = {
  category?: string;
  type?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

type ListEnvelope = ApiResponse<Service[]> & { pagination?: PaginationResponse };

function buildSearch(params?: ListServicesParams) {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.type) search.set("type", params.type);
  if (params?.isActive !== undefined && params.isActive !== "")
    search.set("isActive", params.isActive);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const q = search.toString();
  return q ? `?${q}` : "";
}

export function useServices(params?: ListServicesParams) {
  const suffix = buildSearch(params);
  return useQuery({
    queryKey: ["services", params],
    queryFn: () => api.get<ListEnvelope>(`/services${suffix}`),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceInput) =>
      api.post<ApiResponse<Service>>("/services", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateServiceInput) =>
      api.patch<ApiResponse<Service>>(`/services/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<unknown>>(`/services/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAddTierSurcharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      tier: string;
      surcharge: number;
    }) => api.post<ApiResponse<TierSurchargeRow>>(`/services/${id}/tier-surcharge`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAddComboChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, childServiceId }: { id: string; childServiceId: string }) =>
      api.post<ApiResponse<unknown>>(`/services/${id}/combo`, { childServiceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useSetBranchOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      branchId: string;
      overridePrice: number | null;
      isActive?: boolean;
    }) => api.post<ApiResponse<BranchOverrideRow>>(`/services/${id}/branch-override`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}
