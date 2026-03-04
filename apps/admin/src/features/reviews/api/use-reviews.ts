import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  photoUrls: string[];
  isVisible: boolean;
  createdAt: string;
  queueEntryId: string | null;
  branchId: string | null;
  staffProfileId: string | null;
  customer: { firstName: string; lastName: string } | null;
  staff: { user: { firstName: string; lastName: string } } | null;
}

interface ReviewListResponse {
  items: ReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useReviews(params: {
  branchId?: string;
  staffProfileId?: string;
  minRating?: number;
  page?: number;
  limit?: number;
  includeHidden?: boolean;
}) {
  const search = new URLSearchParams();
  if (params.branchId) search.set("branchId", params.branchId);
  if (params.staffProfileId) search.set("staffProfileId", params.staffProfileId);
  if (params.minRating) search.set("minRating", String(params.minRating));
  search.set("includeHidden", "true");
  search.set("page", String(params.page ?? 1));
  search.set("limit", String(params.limit ?? 20));

  return useQuery({
    queryKey: ["admin-reviews", params],
    queryFn: () => api.get<ApiResponse<ReviewListResponse>>(`/reviews?${search}`),
    enabled: !!params.branchId,
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; isVisible: boolean; moderationNote?: string }) =>
      api.patch<ApiResponse<ReviewItem>>(`/reviews/${data.id}/moderate`, {
        isVisible: data.isVisible,
        moderationNote: data.moderationNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<unknown>>(`/reviews/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });
}
