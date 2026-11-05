import { chromium } from "@playwright/test";

const out = process.argv[2];
const SITE = "http://demo-store-2857.localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${SITE}/track?order=1024`, { waitUntil: "networkidle" });
console.log("prefilled order:", await page.locator("input").first().inputValue());
await page.screenshot({ path: `${out}/track-form.png` });

// Wrong phone → generic message.
await page.locator('input[type="tel"]').fill("01099999999");
await page.getByRole("button", { name: "اعرض حالة الطلب" }).click();
console.log("wrong:", (await page.getByRole("alert").textContent()).trim().slice(0, 30));

// Right phone → the order with its stage.
await page.locator('input[type="tel"]').fill("01501234512");
await page.getByRole("button", { name: "اعرض حالة الطلب" }).click();
await page.getByText("رقم طلبك: #1024").waitFor();
await page.waitForTimeout(400);
console.log("result:", (await page.locator("main").innerText()).split("\n").slice(0, 6).join(" | "));
await page.screenshot({ path: `${out}/track-result.png`, fullPage: true });
console.log("errors:", errors);
await browser.close();
