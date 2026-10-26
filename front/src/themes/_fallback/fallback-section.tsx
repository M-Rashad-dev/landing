import { SCHEMAS } from "@/themes/shared/schemas";
import type { ComponentType, SectionProps } from "@/themes/types";

/**
 * Safety-net renderer: a neutral card with the section name and its main texts.
 * Used for any type a theme does not implement, so a page never breaks.
 */
export function FallbackSection({ type, props }: SectionProps & { type: ComponentType }) {
  const schema = SCHEMAS[type];
  const texts = Object.entries(props)
    .filter(([key, value]) => typeof value === "string" && value.trim() !== "" && !key.endsWith("_url") && !key.endsWith("_color"))
    .slice(0, 4) as Array<[string, string]>;

  return (
    <section className="px-4 py-10" style={{ background: "var(--c-bg)", color: "var(--c-fg)", fontFamily: "var(--font-body)" }}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--c-border)" }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--c-muted)" }}>
          {schema?.label ?? type}
        </p>
        {texts.map(([key, value], index) =>
          index === 0 ? (
            <h2 key={key} className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {value}
            </h2>
          ) : (
            <p key={key} className="mt-2 text-sm" style={{ color: "var(--c-muted)" }}>
              {value}
            </p>
          ),
        )}
      </div>
    </section>
  );
}

export function FallbackThumbnail() {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect x="4" y="4" width="112" height="64" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="4 3" />
      <rect x="30" y="24" width="60" height="8" rx="2" fill="currentColor" fillOpacity="0.3" />
      <rect x="40" y="38" width="40" height="5" rx="2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}
