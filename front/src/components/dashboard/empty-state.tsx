import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center", className)}>
      {Icon ? (
        <div className="relative mb-5 flex size-16 items-center justify-center">
          <span className="absolute inset-0 rotate-6 rounded-2xl bg-gold-soft" aria-hidden />
          <span className="absolute inset-0 -rotate-3 rounded-2xl bg-secondary" aria-hidden />
          <Icon className="relative size-7 text-primary" aria-hidden />
        </div>
      ) : null}
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
