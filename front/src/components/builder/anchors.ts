import type { Section } from "@/themes/types";

/** DOM id / link target of a section: #order for the order form, #section-xxxxxxxx otherwise. */
export function anchorFor(section: Pick<Section, "id" | "type">): string {
  return section.type === "order_form" ? "order" : `section-${section.id.replace(/-/g, "").slice(0, 8)}`;
}

export function anchorHref(section: Pick<Section, "id" | "type">): string {
  return `#${anchorFor(section)}`;
}
