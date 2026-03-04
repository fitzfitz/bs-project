import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { StarRatingInput } from "./star-rating-input";
import { useUploadPhoto } from "../api/use-upload-photo";

const reviewFormSchema = z.object({
  rating: z.number().int().min(1, "Please select a rating").max(5),
  comment: z.string().max(1000).optional(),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

type Props = {
  onSubmit: (data: ReviewFormValues & { photoUrls: string[] }) => void;
  isSubmitting?: boolean;
};

export function ReviewForm({ onSubmit, isSubmitting }: Props) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { rating: 0, comment: "" },
  });

  const comment = form.watch("comment") ?? "";

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = 3 - photoUrls.length;
    const toUpload = files.slice(0, remaining);

    setUploading(true);
    try {
      const results = await Promise.all(
        toUpload.map((file) => uploadPhoto.mutateAsync(file)),
      );
      setPhotoUrls((prev) => [...prev, ...results.map((r) => r.data.url)]);
    } catch {
      // Upload error handled by mutation state
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (values: ReviewFormValues) => {
    onSubmit({ ...values, photoUrls });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        {/* Star Rating */}
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem className="flex flex-col items-center">
              <FormLabel className="text-sm font-semibold text-slate-700">
                How was your experience?
              </FormLabel>
              <StarRatingInput
                value={field.value}
                onChange={field.onChange}
                size="lg"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Comment */}
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-slate-700">
                Your Review
              </FormLabel>
              <textarea
                {...field}
                placeholder="Tell us about your experience..."
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex justify-between">
                <FormMessage />
                <span className="text-xs text-slate-400 ml-auto">
                  {comment.length} / 1000
                </span>
              </div>
            </FormItem>
          )}
        />

        {/* Photo Upload */}
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">
            Photos{" "}
            <span className="font-normal text-slate-400">(optional, max 3)</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {photoUrls.map((url, i) => (
              <div key={i} className="relative">
                <img
                  src={url}
                  alt={`Upload ${i + 1}`}
                  className="h-20 w-20 rounded-lg object-cover border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {photoUrls.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] mt-0.5">Add</span>
                  </>
                )}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full rounded-xl h-12 font-semibold text-md"
          disabled={isSubmitting || uploading}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Review"
          )}
        </Button>
      </form>
    </Form>
  );
}
