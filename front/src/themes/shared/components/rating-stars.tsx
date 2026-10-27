import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={ar.site.rating(value)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-4", i < value ? "fill-amber-400 text-amber-400" : "text-gray-300")} aria-hidden />
      ))}
    </span>
  );
}
