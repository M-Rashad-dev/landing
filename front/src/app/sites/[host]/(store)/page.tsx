import { liveStore } from "@/lib/public/store";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }> };

/** The store home: the published sections of the theme. */
export default async function StoreHome({ params }: Props) {
  const { config } = await liveStore((await params).host);
  const { Home } = storeTheme(config.theme_key);
  return <Home config={config} />;
}
