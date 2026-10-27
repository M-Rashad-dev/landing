import type { TrackingKey } from "./ids";

/**
 * Official loader snippets of each tool, with the (already validated) id inserted
 * through JSON.stringify. Each loader is idempotent (returns early when present).
 */
export type PixelKey = Extract<TrackingKey, "meta_pixel_id" | "tiktok_pixel_id" | "ga4_id" | "gtm_id" | "snapchat_pixel_id">;

export const PIXEL_KEYS: PixelKey[] = ["meta_pixel_id", "tiktok_pixel_id", "ga4_id", "gtm_id", "snapchat_pixel_id"];

/** Global each loader defines synchronously (used to know when events can be sent). */
export const PIXEL_GLOBALS: Record<PixelKey, string> = {
  meta_pixel_id: "fbq",
  tiktok_pixel_id: "ttq",
  ga4_id: "gtag",
  gtm_id: "dataLayer",
  snapchat_pixel_id: "snaptr",
};

export function pixelSnippet(key: PixelKey, id: string): string {
  const v = JSON.stringify(id);
  switch (key) {
    case "meta_pixel_id":
      return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${v});fbq('track','PageView');`;
    case "tiktok_pixel_id":
      return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];if(ttq._i)return;ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load(${v});ttq.page();}(window,document,'ttq');`;
    case "ga4_id":
      return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${v});`;
    case "gtm_id":
      return `(function(w,d,s,l,i){if(w.__lpGtm)return;w.__lpGtm=true;w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${v});`;
    case "snapchat_pixel_id":
      return `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script',r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init',${v},{});snaptr('track','PAGE_VIEW');`;
  }
}

/** External library loaded next to an inline snippet (GA4 only). */
export function pixelSrc(key: PixelKey, id: string): string | null {
  return key === "ga4_id" ? `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}` : null;
}
