import { chromium } from "@playwright/test";

const SITE = "http://demo-store-2857.localhost:3000";
const browser = await chromium.launch();

async function check(url, label) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => r.status() >= 500 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(url, { waitUntil: "networkidle" });

  // Reveal: a section far below starts hidden, shows after scrolling to it.
  const faqSection = page.locator('[data-section-type="faq"]');
  const before = await faqSection.evaluate((el) => getComputedStyle(el).opacity);
  await faqSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const after = await faqSection.evaluate((el) => [getComputedStyle(el).opacity, el.classList.contains("is-revealed")]);

  // Sticky header.
  const headerTop = await page.locator("header").first().evaluate((h) => Math.round(h.getBoundingClientRect().top));

  // FAQ: height grows over time, then exclusive close.
  const items = page.locator("details.t-acc");
  const first = items.nth(1);
  const closed = await first.evaluate((d) => d.offsetHeight);
  await first.locator("summary").click();
  await page.waitForTimeout(120);
  const mid = await first.evaluate((d) => d.offsetHeight);
  await page.waitForTimeout(400);
  const open = await first.evaluate((d) => [d.open, d.offsetHeight]);
  await items.nth(2).locator("summary").click();
  await page.waitForTimeout(500);
  const exclusive = await page.evaluate(() => Array.from(document.querySelectorAll("details.t-acc")).map((d) => d.open));
  await items.nth(2).locator("summary").click();
  await page.waitForTimeout(500);
  const closedAgain = await items.nth(2).evaluate((d) => d.open);

  console.log(`${label}\n  reveal: opacity ${before} → ${after[0]} (revealed ${after[1]}) · sticky header top ${headerTop}px`);
  console.log(`  faq: closed ${closed}px → mid-animation ${mid}px → open ${open[1]}px (${open[0]}) · one-at-a-time ${JSON.stringify(exclusive)} · closes again ${!closedAgain}`);

  // Slider: mouse drag moves it.
  const carousel = page.locator("[aria-roledescription=carousel]");
  if (await carousel.count()) {
    const viewport = carousel.first().locator("> div").first();
    await viewport.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const track = viewport.locator("> div").first();
    const t0 = await track.evaluate((t) => getComputedStyle(t).transform);
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const t1 = await track.evaluate((t) => getComputedStyle(t).transform);
    const dots = await carousel.first().locator("button[aria-current=true]").getAttribute("aria-label");
    console.log(`  slider: drag moved ${t0 !== t1} · current dot "${dots}"`);
  }
  console.log(`  errors: ${JSON.stringify(errors)}`);
  await page.close();
}

await check(`${SITE}/`, "malak");
await check(`${SITE}/smart-watch-celia`, "celia");

// Builder preview: FAQ opens inside the editor.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");
await page.goto("http://app.localhost:3000/dashboard/pages");
const href = await page.locator('a[href*="/builder"]').first().getAttribute("href");
await page.goto(`http://app.localhost:3000${href}`);
const frame = page.frameLocator("iframe").first();
const summary = frame.locator("details.t-acc summary").nth(1);
await summary.scrollIntoViewIfNeeded();
await summary.click();
await page.waitForTimeout(600);
console.log("builder preview: FAQ opens", await frame.locator("details.t-acc").nth(1).evaluate((d) => d.open));
await browser.close();
