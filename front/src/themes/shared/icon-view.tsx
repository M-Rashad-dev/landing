import type { LucideProps } from "lucide-react";
import { ICONS } from "./icons";

/** Renders an icon of the shared set by key (nothing for unknown keys). */
export function IconView({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  if (!name || !(name in ICONS)) return null;
  const Icon = ICONS[name];
  return <Icon aria-hidden {...props} />;
}
