import { liveStore } from "@/lib/public/store";
import { HomeSections } from "@/themes/asas/asas-store";

type Props = { params: Promise<{ host: string }> };

/** The store home: the published sections of the theme. */
export default async function StoreHome({ params }: Props) {
  const { config } = await liveStore((await params).host);
  return <HomeSections sections={config.design.sections} />;
}
