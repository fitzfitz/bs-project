import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Review } from "../types";

type UseReviewsParams = {
  branchId?: string;
  staffProfileId?: string;
  minRating?: number;
  page?: number;
  limit?: number;
  enabled?: boolean;
};

export function useReviews({
  branchId,
  staffProfileId,
  minRating,
  page = 1,
  limit = 20,
  enabled = true,
}: UseReviewsParams = {}) {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  if (staffProfileId) params.set("staffProfileId", staffProfileId);
  if (minRating) params.set("minRating", String(minRating));
  params.set("page", String(page));
  params.set("limit", String(limit));

  return useQuery({
    queryKey: ["reviews", branchId, staffProfileId, minRating, page, limit],
    queryFn: () =>
      api.get<ApiResponse<Review[]>>(`/reviews?${params.toString()}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}
