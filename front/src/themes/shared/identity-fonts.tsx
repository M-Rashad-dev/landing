import { preload } from "react-dom";
import { fontPreloadHref, getFontCss } from "@/lib/fonts";

/** @font-face rules for the two identity fonts only (files bundled under /fonts) + preload of the body font. */
export function IdentityFonts({ heading, body }: { heading: string | null | undefined; body: string | null | undefined }) {
  preload(fontPreloadHref(body), { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return <style dangerouslySetInnerHTML={{ __html: getFontCss([heading, body]) }} />;
}
