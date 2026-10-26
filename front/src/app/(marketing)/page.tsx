import { headers } from "next/headers";
import { MarketingPage } from "./marketing-page";

/** Platform home page (PLATFORM_DOMAIN). Links point to the app host. */
export default async function Home() {
  const appHost = (process.env.APP_HOST ?? "app.localhost").toLowerCase();
  const requestHost = (await headers()).get("host") ?? "";
  const port = requestHost.includes(":") ? requestHost.slice(requestHost.lastIndexOf(":")) : "";
  const isLocal = appHost.endsWith("localhost");
  const appUrl = isLocal ? `http://${appHost}${port}` : `https://${appHost}`;

  return <MarketingPage appUrl={appUrl} />;
}
