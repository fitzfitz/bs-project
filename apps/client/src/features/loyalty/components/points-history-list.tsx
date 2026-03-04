import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LoyaltyTransaction } from "../types";
import type { PaginationResponse } from "@/lib/api";

type Props = {
  transactions: LoyaltyTransaction[];
  pagination?: PaginationResponse;
  page: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
};

export function PointsHistoryList({
  transactions,
  pagination,
  page,
  onPageChange,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
        <div className="text-sm font-semibold text-slate-700 mb-4">
          Points History
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/3 rounded bg-slate-100" />
                <div className="h-3 w-1/3 rounded bg-slate-50" />
              </div>
              <div className="h-4 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <div className="text-sm font-semibold text-slate-700 mb-4">
        Points History
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">
          No transactions yet
        </p>
      ) : (
        <div className="space-y-1">
          {transactions.map((tx) => {
            const isEarn = tx.points > 0;
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isEarn ? "bg-emerald-50" : "bg-red-50"
                  }`}
                >
                  {isEarn ? (
                    <ArrowUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {tx.description}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div
                  className={`text-sm font-bold tabular-nums ${
                    isEarn ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {isEarn ? "+" : ""}
                  {tx.points.toLocaleString("id-ID")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-xs text-slate-400">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
