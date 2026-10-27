import { cn } from "@/lib/utils";

/** Platform logo mark: a lapis tile with a rising gold arrow (a page that sells). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M9 21.5 15 15.5l3.5 3.5L23.5 13" fill="none" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 12.5h5.5V18" fill="none" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
