import * as React from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder with a soft moving shine (static for reduced motion). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden {...props} />;
}
