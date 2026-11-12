/** UTM capture: first-touch values of this visit, kept in sessionStorage. */
const KEY = "lp_utm";
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Utm = { source?: string; medium?: string; campaign?: string; content?: string; term?: string; referrer?: string };

export function parseUtm(search: string, referrer: string): Utm {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key.replace("utm_", "") as keyof Utm] = value.slice(0, 200);
  }
  if (referrer) utm.referrer = referrer.slice(0, 500);
  return utm;
}

/** Store on first visit (does not overwrite), return the stored value. */
export function captureUtm(): Utm {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Utm;
    const referrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : "";
    const utm = parseUtm(window.location.search, referrer);
    window.sessionStorage.setItem(KEY, JSON.stringify(utm));
    return utm;
  } catch {
    return parseUtm(window.location.search, "");
  }
}
