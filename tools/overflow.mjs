import { chromium } from "@playwright/test";
const [, , url, width = "390"] = process.argv;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: Number(width), height: 900 } })).newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
const out = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    let clipped = false; for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (o.overflowX !== "visible") { clipped = true; break; } }
    if (!clipped && (r.left < -1 || r.right > vw + 1) && r.width > 0) {
      const sec = el.closest("[class*=border-b-4]")?.querySelector("p")?.textContent;
      bad.push(`${sec} | <${el.tagName.toLowerCase()} class="${(el.className?.baseVal ?? el.className ?? "").toString().slice(0, 80)}"> L${Math.round(r.left)} R${Math.round(r.right)}`);
    }
  }
  return bad.slice(0, 15);
});
console.log(out.join("\n"));
await browser.close();
