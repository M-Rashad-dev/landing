/** Cookie the proxy sets when it puts the visitor in an A/B test: the test id. */
export const AB_TEST_COOKIE = "lp_abt";

/** The visitor's A/B test id, sent with page events and the order (the server checks the test still runs and has this page). */
export function abTestId(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AB_TEST_COOKIE}=(\\d{1,12})`));
  return match ? Number(match[1]) : null;
}
