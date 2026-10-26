import { Fragment, type ReactNode } from "react";
import { anchorFor } from "@/components/builder/anchors";
import { getComponent, resolveVariant } from "@/themes/registry";
import { SCHEMAS } from "@/themes/shared/schemas";
import type { PageContext, Section } from "@/themes/types";

/**
 * Renders page sections with the theme registry. Pure (no hooks, no fetching):
 * a Server Component on public pages, a client component inside the Builder preview.
 */
export function SiteRenderer({
  themeKey,
  sections,
  ctx,
  includeHidden = false,
  wrap,
}: {
  themeKey: string;
  sections: Section[];
  ctx: PageContext;
  includeHidden?: boolean;
  /** Builder preview: wrap each section (selection outline, click to select). */
  wrap?: (section: Section, node: ReactNode) => ReactNode;
}) {
  return (
    <>
      {sections.map((section) => {
        if (!section.visible && !includeHidden) return null;
        const def = getComponent(themeKey, section.type);
        if (!def) return null;
        const Component = def.component;
        // Stored props merged over defaults, so older content keeps working when fields are added.
        const props = { ...SCHEMAS[section.type].defaults, ...section.props };
        const node = (
          <div id={anchorFor(section)} data-section-id={section.id} data-section-type={section.type} className="scroll-mt-20">
            <Component sectionId={section.id} props={props} variant={resolveVariant(themeKey, section.type, section.variant)} ctx={ctx} />
          </div>
        );
        return <Fragment key={section.id}>{wrap ? wrap(section, node) : node}</Fragment>;
      })}
    </>
  );
}
