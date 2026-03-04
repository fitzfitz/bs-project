import { useState } from "react";
import { Star } from "lucide-react";

type Props = {
  value: number;
  onChange: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
};

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const GAPS = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

export function StarRatingInput({
  value,
  onChange,
  size = "lg",
  readonly = false,
}: Props) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div
      className={`inline-flex items-center ${GAPS[size]}`}
      onMouseLeave={() => !readonly && setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          className={`transition-transform ${readonly ? "cursor-default" : "cursor-pointer active:scale-90 hover:scale-110"}`}
        >
          <Star
            className={`${SIZES[size]} transition-colors ${
              star <= display
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
