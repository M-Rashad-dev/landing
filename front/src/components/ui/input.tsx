import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "flex h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(inputClass, className)} {...props} />;
}
