/**
 * What the dashboard shows of each store theme before it is used: its screenshots (public/themes)
 * and whether it has a showcase store for «معاينة الثيم». The admin's own uploads come first.
 */
export const THEME_SHOTS: Record<string, string[]> = {
  asas: ["/themes/asas.png"],
  sufi: ["/themes/sufi.png", "/themes/sufi-sections.png", "/themes/sufi-dark.png", "/themes/sufi-mobile.png"],
};

/** Themes with a showcase store (themes/{key}/demo.ts). */
export const THEME_DEMOS = new Set(["sufi"]);
