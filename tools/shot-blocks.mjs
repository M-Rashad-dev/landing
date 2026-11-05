import { chromium } from "@playwright/test";

// Adds the six conversion sections to a copy of the demo store's home page, publishes it,
// and screenshots the public page in both themes (mobile + desktop).
const out = process.argv[2];
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");

const call = (path, method = "GET", body) =>
  page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(`/api/bff${path}`, { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { path, method, body },
  );

const pages = (await call("/dashboard/pages")).json.data;
const mediaRes = await call("/dashboard/media");
console.log("media:", mediaRes.status, JSON.stringify(mediaRes.json).slice(0, 200));
let media = mediaRes.json?.data ?? [];
if (media.length < 2) {
  // Two generated photos (dull "before", vivid "after") uploaded like a merchant would.
  const uploaded = await page.evaluate(async () => {
    const make = (from, to, label) =>
      new Promise((resolve) => {
        const c = document.createElement("canvas");
        c.width = 1200;
        c.height = 900;
        const g = c.getContext("2d");
        const grad = g.createLinearGradient(0, 0, 1200, 900);
        grad.addColorStop(0, from);
        grad.addColorStop(1, to);
        g.fillStyle = grad;
        g.fillRect(0, 0, 1200, 900);
        g.fillStyle = "rgba(255,255,255,.85)";
        g.font = "bold 140px sans-serif";
        g.fillText(label, 380, 500);
        c.toBlob((b) => resolve(new File([b], `${label}.png`, { type: "image/png" })), "image/png");
      });
    const form = new FormData();
    form.append("files[]", await make("#8a8f98", "#5b616b", "BEFORE"));
    form.append("files[]", await make("#2a44b8", "#e3a21a", "AFTER"));
    const res = await fetch("/api/bff/dashboard/media", { method: "POST", body: form });
    return { status: res.status, json: await res.json().catch(() => null) };
  });
  console.log("upload:", uploaded.status);
  media = (await call("/dashboard/media")).json.data;
}
const results = {};
for (const theme of ["malak", "celia"]) {
  const source = pages.find((p) => p.theme === theme && p.status === "published") ?? pages[0];
  const copy = (await call(`/dashboard/pages/${source.id}/duplicate`, "POST")).json.data;
  const detail = (await call(`/dashboard/pages/${copy.id}`)).json.data;
  const sections = detail.draft_content.sections;
  const id = () => crypto.randomUUID();
  const extra = [
    { id: id(), type: "video", variant: "framed", visible: true, props: { title: "شوف المنتج على الطبيعة", subtitle: "فيديو قصير", video_url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", poster_media_id: null, cta_label: "اطلب الآن" } },
    { id: id(), type: "before_after", variant: "drag-slider", visible: true, props: { title: "الفرق واضح", subtitle: "اسحب الخط", before_media_id: media.find((m) => /BEFORE/i.test(m.original_name ?? m.name ?? ""))?.id ?? media[1].id, after_media_id: media.find((m) => /AFTER/i.test(m.original_name ?? m.name ?? ""))?.id ?? media[0].id, before_label: "قبل", after_label: "بعد" } },
    { id: id(), type: "comparison", variant: "check-table", visible: true, props: { title: "ليه إحنا؟", subtitle: "قارن بنفسك", us_label: "منتجنا", them_label: "التانيين", rows: [ { feature: "خامة أصلية مضمونة", us: true, them: false }, { feature: "الدفع عند الاستلام", us: true, them: true }, { feature: "استرجاع خلال 14 يوم", us: true, them: false } ] } },
    { id: id(), type: "size_chart", variant: "table", visible: true, props: { title: "جدول المقاسات", note: "القياسات بالسنتيمتر.", size_label: "المقاس", col1_label: "الصدر", col2_label: "الطول", col3_label: "الوزن", rows: [ { size: "M", col1: "96 - 100", col2: "70", col3: "60 - 70 كجم" }, { size: "L", col1: "100 - 106", col2: "72", col3: "70 - 80 كجم" }, { size: "XL", col1: "106 - 112", col2: "74", col3: "80 - 90 كجم" } ] } },
    { id: id(), type: "countdown", variant: theme === "malak" ? "boxes" : "banner", visible: true, props: { title: "العرض ينتهي قريب!", subtitle: "الحق اطلب قبل ما الوقت يخلص", mode: "evergreen", ends_at: "", minutes: 120, expired_text: "انتهى العرض", show_cta: true, cta_label: "الحق العرض" } },
    { id: id(), type: "sticky_cta", variant: "full-bar", visible: true, props: { cta_label: "اطلب الآن والدفع عند الاستلام", show_price: true, show_on_desktop: false } },
  ];
  // After the hero (index 1) so they show near the top.
  const next = [...sections.slice(0, 2), ...extra, ...sections.slice(2)];
  const saved = await call(`/dashboard/pages/${copy.id}/content`, "PUT", { version: detail.version, theme_key: theme, content: { ...detail.draft_content, sections: next } });
  if (saved.status !== 200) throw new Error(`save ${saved.status} ${JSON.stringify(saved.json).slice(0, 400)}`);
  const published = await call(`/dashboard/pages/${copy.id}/publish`, "POST");
  if (published.status !== 200) throw new Error(`publish ${published.status} ${JSON.stringify(published.json).slice(0, 400)}`);
  results[theme] = copy.slug ?? detail.slug;
}
console.log("pages:", JSON.stringify(results));

const host = "http://demo-store-2857.localhost:3000";
for (const [theme, slug] of Object.entries(results)) {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (e) => errors.push(String(e)));
  await mobile.goto(`${host}/${slug}`, { waitUntil: "networkidle" });
  for (const type of ["video", "before_after", "comparison", "size_chart", "countdown"]) {
    const el = mobile.locator(`[data-section-type="${type}"]`);
    await el.scrollIntoViewIfNeeded();
    await mobile.waitForTimeout(900);
    await el.screenshot({ path: `${out}/${theme}-${type}.png` });
  }
  const bar = mobile.locator('[data-section-type="sticky_cta"] a');
  console.log(theme, "sticky visible mid-page:", await bar.isVisible());
  await mobile.screenshot({ path: `${out}/${theme}-sticky.png` });
  await mobile.locator("#order").scrollIntoViewIfNeeded();
  await mobile.waitForTimeout(800);
  const hidden = await mobile.locator('[data-section-type="sticky_cta"] > div').getAttribute("aria-hidden");
  console.log(theme, "sticky hidden at form:", hidden);
  // Slider drag + video click
  const slider = mobile.locator('[data-section-type="before_after"] input[type=range]');
  await slider.scrollIntoViewIfNeeded();
  await slider.fill("20");
  await mobile.locator('[data-section-type="before_after"]').screenshot({ path: `${out}/${theme}-before_after-dragged.png` });
  await mobile.locator('[data-section-type="video"] button').click();
  console.log(theme, "iframe:", await mobile.locator('[data-section-type="video"] iframe').getAttribute("src"));
  await mobile.close();
}
const desk = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await desk.goto(`${host}/${results.malak}`, { waitUntil: "networkidle" });
await desk.locator('[data-section-type="comparison"]').scrollIntoViewIfNeeded();
await desk.waitForTimeout(900);
await desk.screenshot({ path: `${out}/desktop-malak.png` });
await browser.close();
console.log("errors:", errors.length ? errors : "none");
