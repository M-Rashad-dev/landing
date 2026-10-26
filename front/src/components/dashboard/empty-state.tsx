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
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center", className)}>
      {Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon className="size-7" aria-hidden />
        </div>
      ) : null}
      <h2 className="text-lg font-bold">{title}</h2>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
