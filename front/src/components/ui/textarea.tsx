import * as React from "react";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(inputClass, "h-auto min-h-20 resize-y leading-relaxed", className)} {...props} />;
}
