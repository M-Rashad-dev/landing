import type { CSSProperties, ReactNode } from "react";
import { nightColors } from "@/lib/identity/night";
import { identityCssVars, resolveColors } from "@/lib/identity/style";
import { isNightTheme } from "@/themes/color-mode";
import type { PublicIdentity } from "@/themes/types";

/**
 * Applies the identity as CSS variables (--c-*, --font-heading, --font-body, --btn-radius)
 * plus page background/text/font. Themes only read these variables; night themes get a dark
 * palette derived from the same identity.
 */
export function IdentityStyle({ identity, children, className, themeKey }: { identity: PublicIdentity; children: ReactNode; className?: string; themeKey?: string }) {
  const colors = isNightTheme(themeKey) ? nightColors(resolveColors(identity.colors)) : identity.colors;
  const vars = identityCssVars({ ...identity, colors }) as CSSProperties;
  return (
    <div
      className={className}
      data-theme={themeKey}
      style={{
        ...vars,
        background: "var(--c-bg)",
        color: "var(--c-fg)",
        fontFamily: "var(--font-body)",
        ...(isNightTheme(themeKey) ? { colorScheme: "dark" } : {}),
      }}
    >
      {children}
    </div>
  );
}
