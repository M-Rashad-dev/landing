import { ArrowRight, Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { starterContent } from "@/components/builder/store";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { DEMO_IDENTITIES, DEMO_PROP_OVERRIDES, demoContext } from "@/themes/dev/fixtures";
import { THEMES } from "@/themes/registry";
import { SiteEnhancer } from "@/themes/shared/components/site-enhancer";
import { IdentityFonts } from "@/themes/shared/identity-fonts";
import { IdentityStyle } from "@/themes/shared/identity-style";
import { SiteRenderer } from "@/themes/site-renderer";

const t = ar.themeStore.previewBar;
const IDENTITY_KEYS = Object.keys(DEMO_IDENTITIES);
/** Only the image props: the demo testimonials carry stress-test texts for /dev/themes. */
const PREVIEW_OVERRIDES: Record<string, Record<string, unknown>> = { hero: DEMO_PROP_OVERRIDES.hero ?? {}, gallery: DEMO_PROP_OVERRIDES.gallery ?? {} };

type Search = Promise<{ identity?: string; device?: string; frame?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const theme = THEMES[key];
  return { title: theme ? `${ar.themeStore.preview}: ${theme.name}` : ar.themeStore.preview, robots: { index: false, follow: false } };
}

/**
 * Live preview of a theme with sample content (a demo product, demo colors and images),
 * for the theme store. Nothing is read from or sent to any store: the order form is off.
 */
export default async function ThemePreviewPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Search }) {
  const { key } = await params;
  const { identity, device, frame } = await searchParams;
  const theme = THEMES[key];
  if (!theme) notFound();

  const identityKey = identity && IDENTITY_KEYS.includes(identity) ? identity : IDENTITY_KEYS[0];
  const mobile = device === "mobile";
  const href = (changes: Record<string, string>) => `/theme-preview/${key}?${new URLSearchParams({ identity: identityKey, device: mobile ? "mobile" : "desktop", ...changes })}`;

  const ctx = demoContext(DEMO_IDENTITIES[identityKey]);
  const sections = starterContent(key).sections.map((section) => ({ ...section, props: { ...section.props, ...(PREVIEW_OVERRIDES[section.type] ?? {}) } }));
  const site = (
    <>
      <IdentityFonts heading={ctx.identity.font_heading} body={ctx.identity.font_body} />
      <IdentityStyle identity={ctx.identity} themeKey={key} className="t-site min-h-dvh">
        <SiteRenderer themeKey={key} sections={sections} ctx={ctx} />
        <SiteEnhancer />
      </IdentityStyle>
    </>
  );

  // Inside the phone frame: the page alone.
  if (frame === "1") return site;

  return (
    <div className="min-h-dvh bg-neutral-100">
      <div className="sticky top-0 z-[300] flex flex-wrap items-center gap-3 border-b bg-white/95 px-4 py-2 text-sm shadow-sm backdrop-blur" style={{ fontFamily: "system-ui, sans-serif" }}>
        <Link href={`/dashboard/themes/${key}`} className="flex items-center gap-1 font-semibold text-neutral-700 hover:text-neutral-950">
          <ArrowRight className="size-4" aria-hidden />
          {t.back}
        </Link>
        <strong className="text-base">{theme.name}</strong>
        <span className="hidden text-xs text-neutral-500 md:inline">{t.note}</span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">{t.colors}</span>
          {IDENTITY_KEYS.map((k) => (
            <Link
              key={k}
              href={href({ identity: k })}
              aria-label={`${t.colors} ${k}`}
              aria-current={k === identityKey ? "true" : undefined}
              className={cn("size-6 rounded-full border-2", k === identityKey ? "border-neutral-900" : "border-white shadow")}
              style={{ background: DEMO_IDENTITIES[k].colors.primary }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
          <Link href={href({ device: "desktop" })} aria-current={!mobile ? "true" : undefined} className={cn("flex items-center gap-1 rounded-md px-2 py-1", !mobile ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100")}>
            <Monitor className="size-4" aria-hidden />
            {t.desktop}
          </Link>
          <Link href={href({ device: "mobile" })} aria-current={mobile ? "true" : undefined} className={cn("flex items-center gap-1 rounded-md px-2 py-1", mobile ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100")}>
            <Smartphone className="size-4" aria-hidden />
            {t.mobile}
          </Link>
        </div>
      </div>
      {mobile ? (
        <div className="flex justify-center px-4 py-6">
          <iframe title={theme.name} src={`/theme-preview/${key}?identity=${identityKey}&frame=1`} className="h-[812px] w-[390px] max-w-full rounded-[2rem] border-8 border-neutral-900 bg-white shadow-xl" />
        </div>
      ) : (
        site
      )}
    </div>
  );
}
