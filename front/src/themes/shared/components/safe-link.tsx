import type { ReactNode } from "react";
import { safeHref } from "@/lib/links";

/**
 * Renders a content link only if it passes the allow-list; otherwise plain text.
 * External links open in a new tab with noopener/noreferrer. Anchors scroll smoothly (CSS).
 */
export function SafeLink({ href, className, children, ariaLabel }: { href: string | null | undefined; className?: string; children: ReactNode; ariaLabel?: string }) {
  const safe = safeHref(href);
  if (!safe) return <span className={className}>{children}</span>;
  const external = /^https:\/\//i.test(safe);
  return (
    <a href={safe} className={className} aria-label={ariaLabel} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}
