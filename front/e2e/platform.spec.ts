import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { E2E, laravelEnv } from "./env";

/**
 * The six scenarios from PLAN phase 11 (plus the plan limit, v3), in order, on one fresh account:
 * (1) register / logout / login, (2) product + identity, (3) build + publish a page,
 * (4) order from the public page, (5) the order in the dashboard + status change, (6) paid themes locked,
 * (7) the free trial hits its product limit and offers the upgrade,
 * (8) the store pays by transfer + receipt, the admin approves and the plan starts,
 * (9) the store previews and buys a paid theme and owns it after the approval,
 * (10) the Pro store opens its online store and a visitor checks out a cart of two products.
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

test("6. paid themes stay locked in the builder until the store owns them", async ({ page }) => {
  await login(page);

  // The page is listed, and its builder opens with the page settings (theme picker).
  await page.goto("/dashboard/pages");
  await expect(page.getByText(pageInfo.title).first()).toBeVisible();
  await page.goto(builderUrl);
  await expect(page.locator("#b-theme")).toContainText("ملاك");

  // Celia is a paid theme this (trial) store does not own: listed, marked, not selectable.
  await page.locator("#b-theme").click();
  const celia = page.getByRole("option", { name: /سيليا/ });
  await expect(celia).toBeVisible();
  await expect(celia).toContainText("مش ضمن ثيماتك");
  await expect(celia).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  // The public page keeps rendering with the free theme.
  await page.goto(publicUrl);
  await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "malak");
  await expect(page.getByText(product.name).first()).toBeVisible();
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

test("8. the trial store pays by InstaPay, the admin approves and Pro starts", async ({ browser }) => {
  // A super admin for the review (the e2e database starts empty).
  execFileSync(E2E.php, ["artisan", "tinker", "--execute", `App\\Models\\User::factory()->superAdmin()->create(['email' => 'admin${stamp}@example.com', 'password' => '${account.password}']);`], {
    cwd: E2E.backDir,
    env: { ...process.env, ...laravelEnv },
  });
  const signIn = async (email: string, landing: string) => {
    const page = await (await browser.newContext({ locale: "ar-EG" })).newPage();
    await page.goto("/login");
    await page.locator("#login").fill(email);
    await page.locator("#password").fill(account.password);
    await page.getByRole("button", { name: "دخول" }).click();
    await page.waitForURL(`**${landing}`);
    return page;
  };

  // The admin turns InstaPay on with the platform's address.
  const admin = await signIn(`admin${stamp}@example.com`, "/admin");
  await admin.goto("/admin/payments");
  await admin.getByRole("tab", { name: "وسائل الدفع" }).click();
  await admin.locator("#instapay-value").fill("e2e@instapay");
  await admin.getByRole("switch").first().click();
  await admin.getByRole("button", { name: "حفظ" }).first().click();
  await expect(admin.getByText("تم حفظ وسيلة الدفع")).toBeVisible();

  // The trial store chooses Pro, sees where to transfer and uploads the receipt.
  const merchant = await signIn(`trial${stamp}@example.com`, "/dashboard");
  await merchant.goto("/dashboard/plans");
  await merchant.locator("li").filter({ has: merchant.getByRole("heading", { name: "برو" }) }).getByRole("button", { name: "اختار الباقة" }).click();
  // The pay page is only a look: no invoice until the receipt is sent.
  await merchant.waitForURL(/\/dashboard\/billing\/checkout\?/);
  await expect(merchant.getByText("e2e@instapay")).toBeVisible();
  await merchant.goto("/dashboard/billing/invoices");
  await expect(merchant.getByText("مفيش فواتير لسه.")).toBeVisible();
  await merchant.goBack();
  await merchant.locator("#pay-ref").fill("TX-E2E-1");
  // A tiny valid PNG (re-encoded by the back end).
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await merchant.locator("#pay-receipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await merchant.getByRole("button", { name: "إرسال الإيصال" }).click();
  await merchant.waitForURL(/\/dashboard\/billing\/invoices\/\d+$/);
  await expect(merchant.getByText("الإيصال قيد المراجعة")).toBeVisible();

  // The admin approves.
  await admin.goto("/admin/payments");
  const card = admin.locator("li").filter({ hasText: "Trial Store" });
  await card.getByRole("button", { name: "قبول وتفعيل الباقة" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "قبول وتفعيل الباقة" }).click();
  await expect(admin.getByText("تم القبول وتفعيل الباقة")).toBeVisible();

  // The store is on Pro now.
  await merchant.reload();
  await expect(merchant.getByText("تم الدفع")).toBeVisible();
  await merchant.goto("/dashboard/settings/plan");
  await expect(merchant.getByText("برو").first()).toBeVisible();
  await expect(merchant.getByText("شغالة").first()).toBeVisible();
});

test("9. the Pro store previews and buys a paid theme, the admin approves, the theme is its own", async ({ browser }) => {
  const signIn = async (email: string, landing: string) => {
    const page = await (await browser.newContext({ locale: "ar-EG" })).newPage();
    await page.goto("/login");
    await page.locator("#login").fill(email);
    await page.locator("#password").fill(account.password);
    await page.getByRole("button", { name: "دخول" }).click();
    await page.waitForURL(`**${landing}`);
    return page;
  };

  const merchant = await signIn(`trial${stamp}@example.com`, "/dashboard");
  await merchant.goto("/dashboard/themes/store");
  await merchant.getByRole("link", { name: "سيليا" }).first().click();
  await merchant.waitForURL("**/dashboard/themes/celia");

  // The live preview renders the theme with sample content.
  await merchant.goto("/theme-preview/celia");
  await expect(merchant.locator("[data-section-type=hero]").first()).toBeVisible();
  await merchant.goto("/dashboard/themes/celia");

  await merchant.getByRole("button", { name: /اشتري بـ/ }).click();
  await merchant.waitForURL(/\/dashboard\/billing\/checkout\?/);
  await expect(merchant.getByText("ثيم سيليا").first()).toBeVisible();
  await merchant.locator("#pay-ref").fill("TX-THEME-1");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await merchant.locator("#pay-receipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await merchant.getByRole("button", { name: "إرسال الإيصال" }).click();
  await expect(merchant.getByText("الإيصال قيد المراجعة")).toBeVisible();

  const admin = await signIn(`admin${stamp}@example.com`, "/admin");
  await admin.goto("/admin/payments");
  await admin.locator("li").filter({ hasText: "سيليا" }).getByRole("button", { name: "قبول وتفعيل الباقة" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "قبول وتفعيل الباقة" }).click();
  await expect(admin.getByText("تم القبول وتفعيل الباقة")).toBeVisible();

  await merchant.goto("/dashboard/themes");
  await expect(merchant.getByRole("link", { name: "سيليا" }).first()).toBeVisible();
  await expect(merchant.getByText("ملكك").first()).toBeVisible();
});

test("10. the Pro store opens its online store and a visitor buys two products from the cart", async ({ browser }) => {
  const merchant = await (await browser.newContext({ locale: "ar-EG" })).newPage();
  await merchant.goto("/login");
  await merchant.locator("#login").fill(`trial${stamp}@example.com`);
  await merchant.locator("#password").fill(account.password);
  await merchant.getByRole("button", { name: "دخول" }).click();
  await merchant.waitForURL("**/dashboard");

  // A category and two products shown in the store.
  await merchant.goto("/dashboard/store/categories");
  await merchant.getByRole("button", { name: "تصنيف جديد" }).first().click();
  await merchant.locator("#cat-name").fill("مطبخ");
  await merchant.locator("#cat-slug").fill("kitchen");
  await merchant.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
  await expect(merchant.getByTestId("category-row").filter({ hasText: "مطبخ" })).toBeVisible();

  for (const [name, price] of [
    ["كوباية سيراميك", "120"],
    ["طقم ملاعق", "80"],
  ]) {
    await merchant.goto("/dashboard/products/new");
    await merchant.locator("#product-name").fill(name);
    await merchant.locator("#product-price").fill(price);
    await merchant.getByRole("checkbox", { name: "مطبخ" }).click();
    await merchant.locator("button[type=submit]").click();
    await merchant.waitForURL("**/dashboard/products");
  }

  // The store: created with a ready home, published from the builder, then turned on.
  await merchant.goto("/dashboard/store");
  await merchant.getByRole("button", { name: "إنشاء المتجر" }).click();
  await expect(merchant.getByText("حالة المتجر")).toBeVisible();
  await merchant.getByRole("link", { name: "تعديل الرئيسية" }).click();
  await merchant.waitForURL(/\/dashboard\/pages\/\d+\/builder/);
  await merchant.getByRole("button", { name: "نشر", exact: true }).click();
  await expect(merchant.getByRole("dialog").getByText("تم نشر الصفحة")).toBeVisible();
  await merchant.goto("/dashboard/store");
  await merchant.getByRole("switch", { name: "تفعيل المتجر" }).click();
  await expect(merchant.getByTestId("store-status")).toHaveText("المتجر شغال على موقعك");
  const storeUrl = (await merchant.getByRole("link", { name: "زيارة المتجر" }).getAttribute("href")) ?? "";
  expect(storeUrl).toMatch(/^http:\/\/[a-z0-9-]+\.localhost:\d+\/$/);

  // A visitor: home → add from the cards → cart → checkout.
  const visitor = await (await browser.newContext({ locale: "ar-EG" })).newPage();
  await visitor.goto(storeUrl);
  await expect(visitor.getByText("كوباية سيراميك").first()).toBeVisible();
  for (const name of ["كوباية سيراميك", "طقم ملاعق"]) {
    await visitor.locator("article").filter({ hasText: name }).first().getByRole("button", { name: /أضف للسلة/ }).click();
  }
  await expect(visitor.getByTestId("cart-count")).toHaveText("2");

  await visitor.goto(`${storeUrl}categories/kitchen`);
  await expect(visitor.getByTestId("products-count")).toHaveText("منتجين");

  await visitor.goto(`${storeUrl}cart`);
  await expect(visitor.getByTestId("cart-lines").locator("li")).toHaveCount(2);
  await visitor.getByTestId("go-checkout").click();
  await visitor.waitForURL("**/checkout");
  const form = visitor.getByTestId("checkout-form");
  await form.getByLabel(/^الاسم/).fill("زائر المتجر");
  await form.getByLabel(/^رقم الموبايل/).fill("01122334455");
  await form.getByLabel(/^المحافظة/).selectOption("الجيزة");
  await form.getByLabel(/^العنوان بالتفصيل/).fill("10 شارع الهرم");
  await expect(form.getByText("200").first()).toBeVisible();
  // The anti-bot token must be a few seconds old.
  await visitor.waitForTimeout(3500);
  await visitor.getByTestId("place-order").click();
  await expect(visitor.getByTestId("order-success")).toBeVisible();
  await expect(visitor.getByTestId("cart-count")).toHaveCount(0);

  // The merchant sees one store order with both lines.
  await merchant.goto("/dashboard/orders");
  await expect(merchant.getByText("زائر المتجر").first()).toBeVisible();
  await expect(merchant.getByText("+ منتج تاني").first()).toBeVisible();
});
