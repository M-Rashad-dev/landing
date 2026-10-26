import type { CSSProperties, ReactNode } from "react";
import { identityCssVars } from "@/lib/identity/style";
import type { PublicIdentity } from "@/themes/types";

/**
 * Applies the identity as CSS variables (--c-*, --font-heading, --font-body, --btn-radius)
 * plus page background/text/font. Themes only read these variables.
 */
export function IdentityStyle({ identity, children, className }: { identity: PublicIdentity; children: ReactNode; className?: string }) {
  const vars = identityCssVars(identity) as CSSProperties;
  return (
    <div
      className={className}
      style={{
        ...vars,
        background: "var(--c-bg)",
        color: "var(--c-fg)",
        fontFamily: "var(--font-body)",
        minHeight: "100%",
      }}
    >
      {children}
    </div>
  );
}
