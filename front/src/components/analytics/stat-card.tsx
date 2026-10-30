import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** KPI tile shared by the analytics and A/B screens (same look as the home overview). */
export function StatCard({ icon: Icon, label, value, hint, highlight = false }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn("flex h-full flex-col gap-3 p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md", highlight && "border-gold/50 bg-gold-soft")}>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", highlight ? "bg-gold text-gold-foreground" : "bg-secondary text-primary")}>
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </span>
      <span className={cn("font-display text-2xl font-semibold tabular-nums", highlight && "text-gold-foreground")}>{value}</span>
      {hint ? <span className="-mt-1 text-xs text-muted-foreground">{hint}</span> : null}
    </Card>
  );
}
