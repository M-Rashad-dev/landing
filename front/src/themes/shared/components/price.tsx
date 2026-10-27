import { discountPercent, formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";

/** Current price (large) + struck compare-at price + optional discount badge. */
export function Price({
  price,
  compareAt,
  showCompare = true,
  showBadge = false,
  badgeText,
  className,
  priceClassName,
  compareClassName,
  badgeClassName,
  inverted = false,
}: {
  price: number;
  compareAt?: number | null;
  showCompare?: boolean;
  showBadge?: boolean;
  badgeText?: string | null;
  className?: string;
  priceClassName?: string;
  compareClassName?: string;
  badgeClassName?: string;
  /** On dark/photo backgrounds: the old price uses the current text color, faded. */
  inverted?: boolean;
}) {
  const percent = discountPercent(price, compareAt);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className={cn("font-extrabold tabular-nums", priceClassName)}>{formatPrice(price)}</span>
      {showCompare && compareAt && compareAt > price ? (
        <del className={cn(inverted ? "opacity-75" : "t-muted", "tabular-nums", compareClassName)} aria-label={formatPrice(compareAt)}>
          {formatPrice(compareAt)}
        </del>
      ) : null}
      {badgeText ? <span className={cn("t-accent px-2.5 py-0.5 text-xs font-bold", badgeClassName)}>{badgeText}</span> : showBadge && percent ? <span className={cn("t-accent px-2.5 py-0.5 text-xs font-bold", badgeClassName)}>-{percent}%</span> : null}
    </div>
  );
}
