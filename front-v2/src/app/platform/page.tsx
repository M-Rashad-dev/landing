import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { MarketingHeader } from "@/features/marketing/header";
import "@/features/marketing/marketing.css";
import { MotionRoot } from "@/features/marketing/motion";
import { appUrl, pricingData, whatsappUrl } from "@/features/marketing/plans";
import { ClosingCta, FaqSection, LandingSection, MarketingFooter, OrdersSection, PricingSection, ToolsSection } from "@/features/marketing/sections-bottom";
import { BuilderSection, Facts, Hero, Journey, StoreSection } from "@/features/marketing/sections-top";
import { ar } from "@/messages/ar";

const m = ar.marketing;

/** Same as PLANS_REVALIDATE: the admin's plan edits show within 5 minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | ${m.meta.title}` },
  description: m.meta.description,
  robots: { index: true, follow: true },
  openGraph: { title: `${BRAND.name} | ${m.meta.title}`, description: m.meta.description, type: "website", locale: "ar_EG" },
};

/**
 * The platform's home page, served on the platform domain at "/" (the proxy rewrites it here;
 * /platform itself is not reachable). The pricing comes from the same plans the billing uses.
 */
export default async function PlatformHome() {
  const data = await pricingData();
  const registerUrl = appUrl("/register");
  const loginUrl = appUrl("/login");

  return (
    <div className="mk">
      {/* Before paint: hide what will animate in (skipped for reduced motion, so nothing stays hidden). */}
      <script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('mk-js')" }} />
      <MotionRoot />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        {m.nav.skip}
      </a>
      <div className="bg-[var(--mk-deep)] px-4 py-2.5 text-center text-[13px] text-[#cfe3d7]">
        <span className="me-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-ink">{m.announce.badge}</span>
        {m.announce.text}{" "}
        <a href="#landing" className="font-semibold text-brand">
          {m.announce.link} ←
        </a>
      </div>
      <MarketingHeader loginUrl={loginUrl} registerUrl={registerUrl} />
      <main id="main">
        <Hero registerUrl={registerUrl} />
        <Facts />
        <Journey />
        <StoreSection />
        <BuilderSection />
        <LandingSection />
        <OrdersSection />
        <ToolsSection />
        <PricingSection data={data} registerUrl={registerUrl} />
        <FaqSection whatsapp={whatsappUrl(data?.support.whatsapp ?? null)} />
        <ClosingCta registerUrl={registerUrl} />
      </main>
      <MarketingFooter loginUrl={loginUrl} registerUrl={registerUrl} support={data?.support ?? null} />
    </div>
  );
}
