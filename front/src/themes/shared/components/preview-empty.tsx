import type { PageContext } from "@/themes/types";

/**
 * A section with nothing to show renders nothing on the live page; in the Builder
 * preview it shows a faint placeholder so the section can still be selected.
 */
export function PreviewEmpty({ ctx, label }: { ctx: PageContext; label?: string }) {
  if (!ctx.isPreview) return null;
  return (
    <div className="px-4 py-8">
      <div className="t-border t-muted mx-auto max-w-3xl rounded-2xl border border-dashed p-6 text-center text-sm">{label || "—"}</div>
    </div>
  );
}
