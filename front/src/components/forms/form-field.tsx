import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/** Label + control + hint + error. Pass the control's id as htmlFor. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  optional,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="flex items-center gap-1">
          {label}
          {required ? <span className="text-destructive" aria-hidden>*</span> : null}
          {optional ? <span className="text-xs font-normal text-muted-foreground">({ar.common.optional})</span> : null}
        </Label>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
