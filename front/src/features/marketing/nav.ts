import { ar } from "@/messages/ar";

const t = ar.marketing.nav;

/** The page's sections, for the header and the footer (ids match the section anchors). */
export const SECTIONS = [
  { id: "store", label: t.store },
  { id: "landing", label: t.landing },
  { id: "orders", label: t.orders },
  { id: "pricing", label: t.pricing },
  { id: "faq", label: t.faq },
] as const;
