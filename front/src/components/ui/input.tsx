import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "flex h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base shadow-xs transition-[border-color,box-shadow] duration-150 md:text-sm placeholder:text-muted-foreground/70 hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(inputClass, className)} {...props} />;
}
