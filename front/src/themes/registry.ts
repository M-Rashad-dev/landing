/**
 * What the dashboard shows of each shipped theme (store and landing) before it is used: a cover
 * and five pictures of what it has (public/themes/{store|landing}/{key}), and whether it has a showcase store for
 * «معاينة الثيم». The admin's own uploads come first.
 */
const shots = (kind: "store" | "landing", key: string) => ["cover", "1", "2", "3", "4", "5"].map((n) => `/themes/${kind}/${key}/${n}.webp`);

export const THEME_SHOTS: Record<string, string[]> = {
  asas_store: shots("store", "asas"),
  sufi_store: shots("store", "sufi"),
  bidaya_landing: shots("landing", "bidaya"),
  shabe_landing: shots("landing", "shabe"),
};

/** Themes with a showcase store (themes/store/{key}/demo.ts). */
export const THEME_DEMOS = new Set(["sufi_store"]);
