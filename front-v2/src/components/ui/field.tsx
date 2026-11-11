import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/** Label + control + hint / error. Error wins over hint; ids wire aria-describedby. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  optional = false,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-[13px] font-semibold text-ink">
          {label}
          {required ? <span className="text-danger" aria-hidden>*</span> : null}
          {optional ? <span className="font-normal text-ink-3">({ar.common.optional})</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
