import { liveStore } from "@/lib/public/store";
import { HomeSections } from "@/themes/asas/asas-store";
import { SufiHomeSections } from "@/themes/sufi/sufi-store";
import { SUFI_KEY, type SufiSection } from "@/themes/sufi/types";

type Props = { params: Promise<{ host: string }> };

/** The store home: the published sections of the theme. */
export default async function StoreHome({ params }: Props) {
  const { config } = await liveStore((await params).host);
  if (config.theme_key === SUFI_KEY) return <SufiHomeSections sections={config.design.sections as unknown as SufiSection[]} />;
  return <HomeSections sections={config.design.sections} />;
}
