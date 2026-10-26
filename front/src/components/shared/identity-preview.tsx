import "@/components/shared/dashboard-fonts";
import type { CSSProperties } from "react";
import { identityCssVars, type IdentityStyleInput } from "@/lib/identity/style";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/** Live card: logo + heading + text + button using the identity's colors, fonts and radius. */
export function IdentityPreview({
  identity,
  brandName,
  logo,
  compact = false,
  className,
}: {
  identity: IdentityStyleInput;
  brandName: string;
  logo?: MediaItem | null;
  compact?: boolean;
  className?: string;
}) {
  const vars = identityCssVars(identity) as CSSProperties;

  return (
    <div
      style={{ ...vars, background: "var(--c-bg)", color: "var(--c-fg)", borderColor: "var(--c-border)", fontFamily: "var(--font-body)" }}
      className={cn("overflow-hidden rounded-xl border", className)}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--c-border)" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- static media served by Caddy
          <img src={logo.urls.thumb} alt="" className="h-7 w-auto max-w-24 object-contain" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--c-primary)", color: "var(--c-primary-fg)" }}>
            {brandName.trim().charAt(0) || "؟"}
          </span>
        )}
        <span className="truncate text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          {brandName || ar.identities.fields.brandName}
        </span>
      </div>
      <div className={cn("flex flex-col gap-3", compact ? "p-4" : "p-6")} style={{ background: "linear-gradient(180deg, var(--c-secondary), var(--c-bg))" }}>
        <p className={cn("font-bold leading-snug", compact ? "text-base" : "text-xl")} style={{ fontFamily: "var(--font-heading)" }}>
          {ar.identities.previewTitle}
        </p>
        {!compact ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--c-muted)" }}>
            {ar.identities.previewText}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="inline-flex px-4 py-2 text-sm font-semibold" style={{ background: "var(--c-primary)", color: "var(--c-primary-fg)", borderRadius: "var(--btn-radius)" }}>
            {ar.identities.previewButton}
          </span>
          <span className="inline-flex px-3 py-1 text-xs font-semibold" style={{ background: "var(--c-accent)", color: "#111", borderRadius: "var(--btn-radius)" }}>
            -30%
          </span>
        </div>
      </div>
    </div>
  );
}
