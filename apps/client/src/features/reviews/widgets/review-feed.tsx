import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviews } from "../api/use-reviews";
import { ReviewCard } from "../components/review-card";
import { ReviewSummary } from "../components/review-summary";

type Props = {
  branchId?: string;
  staffProfileId?: string;
  averageRating?: number;
  totalReviews?: number;
  showSummary?: boolean;
  pageSize?: number;
};

export function ReviewFeed({
  branchId,
  staffProfileId,
  averageRating,
  totalReviews,
  showSummary = true,
  pageSize = 10,
}: Props) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useReviews({
    branchId,
    staffProfileId,
    page,
    limit: pageSize,
    enabled: !!(branchId || staffProfileId),
  });

  const reviews = data?.data ?? [];
  const pagination = data?.pagination;
  const hasMore = pagination ? page < pagination.totalPages : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (reviews.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
          <MessageSquare className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm text-slate-500 font-medium">No reviews yet</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Be the first to leave a review!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showSummary && reviews.length > 0 && (
        <ReviewSummary
          reviews={reviews}
          averageRating={averageRating}
          totalReviews={totalReviews}
        />
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching}
            className="rounded-xl"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Load More Reviews
          </Button>
        </div>
      )}
    </div>
  );
}
