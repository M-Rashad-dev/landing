import { captureUtm } from "./utm";

/** Cookie the proxy sets when it puts the visitor in an A/B test: the test id. */
export const AB_TEST_COOKIE = "lp_abt";

/** The visitor's A/B test id (the server checks it still runs and includes the page). */
export function abTestId(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AB_TEST_COOKIE}=(\\d{1,12})`));
  return match ? Number(match[1]) : null;
}

function device(): "mobile" | "desktop" {
  try {
    return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches ? "desktop" : "mobile";
  } catch {
    return "mobile";
  }
}

/**
 * Counts a page view (once per page per browser session) or the first touch of the order form.
 * Fire-and-forget: analytics never blocks or breaks the page.
 */
export function sendPageEvent(slug: string, type: "view" | "form_start"): void {
  const flag = `lp_ev_${type}_${slug}`;
  try {
    if (window.sessionStorage.getItem(flag) === "1") return;
    window.sessionStorage.setItem(flag, "1");
  } catch {
    // Storage blocked: count anyway.
  }
  const utm = captureUtm();
  fetch("/api/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ slug, type, utm_source: utm.source ?? null, referrer: utm.referrer ?? null, device: device(), ab: abTestId() }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
