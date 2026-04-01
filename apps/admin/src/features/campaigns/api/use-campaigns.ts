import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type Campaign = {
  id: string;
  branchId: string | null;
  name: string;
  description: string | null;
  type: "EMAIL" | "PUSH" | "SMS" | "IN_APP";
  promoCodeId: string | null;
  segmentId: string | null;
  status: "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED";
  startsAt: string;
  endsAt: string | null;
  sentCount: number;
  openCount: number;
  createdAt: string;
};

export type CampaignListParams = {
  branchId?: string;
  status?: Campaign["status"];
  page?: number;
  limit?: number;
};

export function useCampaigns(params: CampaignListParams) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.status) search.set("status", params.status);
  search.set("page", String(params.page ?? 1));
  search.set("limit", String(params.limit ?? 20));

  return useQuery({
    queryKey: ["campaigns", params],
    queryFn: () => api.get<ApiResponse<Campaign[]>>(`/campaigns?${search}`),
  });
}

export type CreateCampaignBody = {
  name: string;
  type: Campaign["type"];
  startsAt: string;
  branchId?: string;
  description?: string;
  promoCodeId?: string;
  segmentId?: string;
  endsAt?: string;
};

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCampaignBody) =>
      api.post<ApiResponse<Campaign>>("/campaigns", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export type UpdateCampaignBody = Partial<{
  name: string;
  description: string | null;
  type: Campaign["type"];
  promoCodeId: string | null;
  segmentId: string | null;
  status: "DRAFT" | "SCHEDULED" | "CANCELLED";
  startsAt: string;
  endsAt: string | null;
}>;

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCampaignBody }) =>
      api.patch<ApiResponse<Campaign>>(`/campaigns/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: true; message: string }>(`/campaigns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export type SendCampaignResult = { sent: number; recipientCount: number };

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<SendCampaignResult>>(`/campaigns/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
