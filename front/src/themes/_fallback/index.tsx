import { COMPONENT_TYPES, type ComponentType, type SectionProps, type ThemeComponentDef } from "@/themes/types";
import { FallbackSection, FallbackThumbnail } from "./fallback-section";

function fallbackFor(type: ComponentType): ThemeComponentDef {
  function Component(props: SectionProps) {
    return <FallbackSection {...props} type={type} />;
  }
  Component.displayName = `Fallback(${type})`;
  return { component: Component, variants: [{ key: "default", label: "default" }], defaultVariant: "default", Thumbnail: FallbackThumbnail };
}

/** One placeholder per known type (also the safety net for unknown types). */
export const FALLBACK_COMPONENTS = Object.fromEntries(COMPONENT_TYPES.map((type) => [type, fallbackFor(type)])) as Record<ComponentType, ThemeComponentDef>;
