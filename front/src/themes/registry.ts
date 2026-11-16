/**
 * What the dashboard shows of each shipped theme (store and landing) before it is used: a cover
 * and five pictures of what it has (public/themes/{key}), and whether it has a showcase store for
 * «معاينة الثيم». The admin's own uploads come first.
 */
const shots = (key: string) => ["cover", "1", "2", "3", "4", "5"].map((n) => `/themes/${key}/${n}.webp`);

export const THEME_SHOTS: Record<string, string[]> = {
  asas: shots("asas"),
  sufi: shots("sufi"),
  bidaya: shots("bidaya"),
  shabe: shots("shabe"),
};

/** Themes with a showcase store (themes/{key}/demo.ts). */
export const THEME_DEMOS = new Set(["sufi"]);
