import { expect, test, type Page } from "@playwright/test";

/**
 * The six scenarios from PLAN phase 11 (plus the plan limit, v3), in order, on one fresh account:
 * (1) register / logout / login, (2) product + identity, (3) build + publish a page,
 * (4) order from the public page, (5) the order in the dashboard + status change, (6) switch theme,
 * (7) the free trial hits its product limit and offers the upgrade.
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const account = {
  name: "تاجر التجربة",
  email: `e2e${stamp}@example.com`,
  phone: `010${String(stamp).slice(-8)}`,
  store: "E2E Store",
  password: "e2e-pass-1234",
};
const product = { name: "مج حراري E2E", price: "275" };
const pageInfo = { title: "صفحة المج", slug: `mug-${stamp}` };
let publicUrl = "";
let builderUrl = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#login").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await page.waitForURL("**/dashboard");
}

test("1. register, log out and log back in", async ({ page }) => {
  await page.goto("/register");
  await page.locator("#name").fill(account.name);
  await page.locator("#email").fill(account.email);
  await page.locator("#phone").fill(account.phone);
  await page.locator("#store_name").fill(account.store);
  await page.locator("#password").fill(account.password);
  await page.locator("#password_confirmation").fill(account.password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByText(account.store).first()).toBeVisible();

  await page.getByRole("button", { name: "حسابي" }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.waitForURL("**/login");

  // The dashboard is closed after logout.
  await page.goto("/dashboard");
  await page.waitForURL("**/login**");

  await login(page);
  await expect(page.getByText(account.store).first()).toBeVisible();
});

test("2. create a product and an identity", async ({ page }) => {
  await login(page);

  await page.goto("/dashboard/products/new");
  await page.locator("#product-name").fill(product.name);
  await page.locator("#product-price").fill(product.price);
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/dashboard/products");
  await expect(page.getByText(product.name).first()).toBeVisible();

  await page.goto("/dashboard/identities/new");
  await page.locator("#name").fill("هوية الصيف");
  await page.locator("#brand_name").fill("براند الصيف");
  await page.locator("button[type=submit]").click();
  await page.waitForURL(/\/dashboard\/identities\/\d+$/);
  await page.goto("/dashboard/identities");
  await expect(page.getByText("هوية الصيف").first()).toBeVisible();
});

test("3. build a page from a theme and publish it", async ({ page }) => {
  await login(page);

  await page.goto("/dashboard/pages/new");
  // Templates are the default start; this flow builds a blank Malak page.
  await page.getByRole("tab", { name: "صفحة فاضية بثيم" }).click();
  await page.getByRole("radio", { name: /ملاك/ }).click();
  await page.locator("#wiz-title").fill(pageInfo.title);
  await page.locator("#wiz-slug").fill(pageInfo.slug);
  await page.locator("#wiz-product").click();
  await page.getByRole("option", { name: product.name }).click();
  await page.getByRole("button", { name: "إنشاء وفتح المحرر" }).click();

  await page.waitForURL(/\/dashboard\/pages\/\d+\/builder/);
  builderUrl = page.url();
  await page.getByRole("button", { name: "نشر", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("تم نشر الصفحة")).toBeVisible();
  publicUrl = (await dialog.getByText(new RegExp(`/${pageInfo.slug}$`)).first().textContent())?.trim() ?? "";
  expect(publicUrl).toMatch(new RegExp(`^http://[a-z0-9-]+\\.localhost:\\d+/${pageInfo.slug}$`));
});

test("4. order from the published page", async ({ page }) => {
  await page.goto(publicUrl);
  await expect(page).toHaveTitle(/.+/);
  await expect(page.getByText(product.name).first()).toBeVisible();

  await page.getByLabel(/^الاسم/).fill("عميل التجربة");
  await page.getByLabel(/^رقم الموبايل/).fill("01098765432");
  await page.getByLabel(/^المحافظة/).selectOption("القاهرة");
  await page.getByLabel(/^العنوان بالتفصيل/).fill("15 شارع التجربة، مدينة نصر");

  // The anti-bot token needs the form to be open for at least 3 seconds.
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /تأكيد الطلب/ }).click();

  await expect(page.getByText("رقم طلبك: #1001")).toBeVisible();
});

test("5. the order shows in the dashboard and changes status", async ({ page }) => {
  await login(page);

  await page.goto("/dashboard/orders");
  const row = page.getByText("عميل التجربة").first();
  await expect(row).toBeVisible();
  await row.click();
  await page.waitForURL(/\/dashboard\/orders\/\d+$/);
  await expect(page.getByText("#1001").first()).toBeVisible();
  await expect(page.getByText(/275/).first()).toBeVisible();

  await page.getByRole("button", { name: "تحويل إلى «مؤكد»" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد", exact: true }).click();
  await expect(page.getByRole("button", { name: "تحويل إلى «تم التسليم»" })).toBeVisible();
});

test("6. switch the page theme without losing content", async ({ page }) => {
  await login(page);

  // The page is listed, and its builder opens with the page settings (theme picker).
  await page.goto("/dashboard/pages");
  await expect(page.getByText(pageInfo.title).first()).toBeVisible();
  await page.goto(builderUrl);
  await expect(page.locator("#b-theme")).toContainText("ملاك");

  await page.locator("#b-theme").click();
  await page.getByRole("option", { name: "سيليا" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تبديل" }).click();
  await expect(page.locator("#b-theme")).toContainText("سيليا");
  await expect(page.getByText("محفوظ").first()).toBeVisible();

  await page.getByRole("button", { name: "نشر", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("تم نشر الصفحة")).toBeVisible();

  // Same product and order form on the public page, now rendered by Celia (revalidated on publish).
  await expect
    .poll(
      async () => {
        await page.goto(publicUrl);
        return page.locator("[data-theme]").first().getAttribute("data-theme");
      },
      { timeout: 30_000 },
    )
    .toBe("celia");
  await expect(page.getByText(product.name).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /تأكيد الطلب/ })).toBeVisible();
});

test("7. the free trial (basic) stops at its product limit with an upgrade dialog", async ({ page }) => {
  // A second, new store (signing up starts the trial; logging in again would hit the login rate limit).
  await page.goto("/register");
  await page.locator("#name").fill(account.name);
  await page.locator("#email").fill(`trial${stamp}@example.com`);
  await page.locator("#phone").fill(`011${String(stamp).slice(-8)}`);
  await page.locator("#store_name").fill("Trial Store");
  await page.locator("#password").fill(account.password);
  await page.locator("#password_confirmation").fill(account.password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.waitForURL("**/dashboard");

  // The trial banner and the plan page.
  await expect(page.getByRole("status").filter({ hasText: "التجربة المجانية" })).toBeVisible();
  await page.goto("/dashboard/settings/plan");
  await expect(page.getByText("بيسك").first()).toBeVisible();

  // Basic allows 5 products. Fill them through the dashboard API from the page (same cookie and host).
  const statuses = await page.evaluate(async () => {
    const out: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = await fetch("/api/bff/dashboard/products", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ name: `منتج ${i}`, price: 10 }) });
      out.push(res.status);
    }
    return out;
  });
  expect(statuses).toEqual([201, 201, 201, 201, 201]);

  await page.goto("/dashboard/products/new");
  await page.locator("#product-name").fill("منتج زيادة");
  await page.locator("#product-price").fill("10");
  await page.locator("button[type=submit]").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("وصلت لحد باقتك")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /برو/ })).toBeVisible();
  await dialog.getByRole("link", { name: /برو/ }).click();
  await page.waitForURL("**/dashboard/plans");
  await expect(page.getByText("مقارنة الباقات")).toBeVisible();
});
