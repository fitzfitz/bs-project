import { X, CheckCircle } from "lucide-react";
import { useState } from "react";
import { ReviewForm } from "../components/review-form";
import { useCreateReview } from "../api/use-create-review";

type Props = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  staffProfileId?: string;
  queueEntryId?: string;
};

export function PostReviewDialog({
  open,
  onClose,
  branchId,
  staffProfileId,
  queueEntryId,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const createReview = useCreateReview();

  if (!open) return null;

  const handleSubmit = (data: {
    rating: number;
    comment?: string;
    photoUrls: string[];
  }) => {
    createReview.mutate(
      {
        branchId,
        staffProfileId,
        queueEntryId,
        rating: data.rating,
        comment: data.comment,
        photoUrls: data.photoUrls,
      },
      {
        onSuccess: () => setSubmitted(true),
      },
    );
  };

  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Sheet / Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-300">
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h2 className="text-lg font-bold text-slate-900">Leave a Review</h2>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-8">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Thank you!
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Your review has been submitted successfully.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 text-sm font-semibold text-primary hover:underline"
              >
                Done
              </button>
            </div>
          ) : (
            <ReviewForm
              onSubmit={handleSubmit}
              isSubmitting={createReview.isPending}
            />
          )}

          {createReview.isError && !submitted && (
            <p className="mt-3 text-center text-sm text-red-500">
              {createReview.error?.message ?? "Failed to submit review"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
