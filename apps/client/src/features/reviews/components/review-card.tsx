import { Star, User as UserIcon } from "lucide-react";
import type { Review } from "../types";

type Props = {
  review: Review;
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${
            s <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewCard({ review }: Props) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <UserIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {review.customerName}
            </span>
            <span className="text-xs text-slate-400 shrink-0">
              {new Date(review.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarDisplay rating={review.rating} />
            {review.staffName && (
              <span className="text-xs text-slate-400">
                with {review.staffName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {review.comment}
        </p>
      )}

      {/* Photos */}
      {review.photoUrls.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {review.photoUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Review photo ${i + 1}`}
              className="h-20 w-20 rounded-lg object-cover border border-slate-100 shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}
