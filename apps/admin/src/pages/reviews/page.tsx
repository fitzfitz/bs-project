import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, Eye, EyeOff, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { BranchSelector } from "@/components/branch-selector";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useBranchStore } from "@/store/use-branch-store";
import {
  useReviews,
  useModerateReview,
  useDeleteReview,
  type ReviewItem,
} from "@/features/reviews/api/use-reviews";
import { useSessionStore } from "@/features/auth/store";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const moderate = useModerateReview();
  const remove = useDeleteReview();
  const tenantRoleScope = useSessionStore((s) => s.user?.tenantRole?.scope);
  const customerName = review.customerName.trim() || "Anonymous";
  const staffName = review.staffName?.trim() || "—";

  return (
    <div
      className={`rounded-xl border bg-white p-5 transition-opacity ${
        !review.isVisible ? "opacity-60 border-red-200 bg-red-50/30" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-semibold text-slate-900">{customerName}</span>
            <StarDisplay rating={review.rating} />
            {!review.isVisible && (
              <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                Hidden
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-2">
            Barber: {staffName} &middot;{" "}
            {new Date(review.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          {review.comment && (
            <p className="text-sm text-slate-700 leading-relaxed">{review.comment}</p>
          )}
          {review.photoUrls.length > 0 && (
            <div className="flex gap-2 mt-3">
              {review.photoUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Review photo ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              moderate.mutate({
                id: review.id,
                isVisible: !review.isVisible,
                moderationNote: review.isVisible ? "Hidden by admin" : "Restored by admin",
              })
            }
            disabled={moderate.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title={review.isVisible ? "Hide review" : "Show review"}
          >
            {review.isVisible ? (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Hide
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Show
              </>
            )}
          </button>
          {tenantRoleScope === "HQ" && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Permanently delete this review?")) {
                  remove.mutate(review.id);
                }
              }}
              disabled={remove.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const { t } = useTranslation();
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();

  const { data, isLoading, error } = useReviews({
    branchId: branchId ?? undefined,
    minRating: ratingFilter,
    page,
    limit: 20,
  });

  const reviews = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total = data?.pagination?.total ?? 0;

  return (
    <PageContainer>
      <PageHeader title={t("reviews:title")} actions={<BranchSelector />} />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-500">{t("reviews:filterByRating")}</span>
        {[undefined, 5, 4, 3, 2, 1].map((r) => (
          <button
            key={r ?? "all"}
            onClick={() => {
              setRatingFilter(r);
              setPage(1);
            }}
            className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors ${
              ratingFilter === r
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r ? `${r}★+` : "All"}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-400">{total} reviews</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load reviews: {(error as Error).message}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Star className="mx-auto h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No reviews yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Reviews will appear here when customers leave feedback.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </PageContainer>
  );
}
