import { Star } from "lucide-react";
import type { Review } from "../types";

type Props = {
  reviews: Review[];
  averageRating?: number;
  totalReviews?: number;
};

export function ReviewSummary({ reviews, averageRating, totalReviews }: Props) {
  const total = totalReviews ?? reviews.length;
  if (total === 0) return null;

  const avg =
    averageRating ??
    (reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0);

  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <div className="flex items-start gap-5">
        {/* Average score */}
        <div className="flex flex-col items-center shrink-0">
          <div className="text-4xl font-black text-slate-900 tabular-nums">
            {avg.toFixed(1)}
          </div>
          <div className="flex items-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3.5 w-3.5 ${
                  s <= Math.round(avg)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-slate-200"
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {total} review{total !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Distribution bars */}
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-3 text-right">
                  {star}
                </span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 w-7 text-right tabular-nums">
                  {Math.round(pct)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
