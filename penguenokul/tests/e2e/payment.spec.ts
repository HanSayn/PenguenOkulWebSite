import { expect, test } from "@playwright/test";
import { DEMO, login, registerStudent } from "./helpers";

test.describe("paket satın alma (test ödeme sayfası)", () => {
  test("başarılı ödeme: paket tanımlanır, PDF belge indirilir", async ({ page, request, browser }) => {
    const me = await registerStudent(request, "pay-ok");
    await login(page, me.email, me.password);
    await page.waitForURL(/\/ogrenci/);

    await page.goto("/ogrenci/paketler");
    await page.locator("article", { hasText: "1 Aylık Paket" }).getByRole("button", { name: "Satın al" }).click();
    await page.waitForURL(/\/odeme\/sahte\/mock_/);
    await expect(page.getByText("test ödeme sayfasıdır")).toBeVisible();

    await page.getByRole("button", { name: "Ödemeyi onayla" }).click();
    await page.waitForURL(/\/ogrenci\/odemeler\?odeme=/);
    await expect(page.getByText("Ödemen alındı, paketin hesabına tanımlandı.")).toBeVisible();
    await expect(page.locator("main")).toContainText(/PO-\d{4}-\d{6}/);

    await page.goto("/ogrenci/paketler");
    await expect(page.getByText("8 ders hakkı")).toBeVisible();

    const href = await page.goto("/ogrenci/odemeler").then(() => page.locator('a:has-text("Belgeyi aç")').first().getAttribute("href"));
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    // başka bir öğrenci bu belgeye erişemez
    const other = await registerStudent(request, "pay-other");
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.77.1.1" } });
    const p2 = await ctx.newPage();
    await login(p2, other.email, other.password);
    await p2.waitForURL(/\/ogrenci/);
    expect((await p2.request.get(href!)).status()).toBe(404);
    await ctx.close();
  });

  test("başarısız ödeme: paket tanımlanmaz, belge oluşmaz", async ({ page, request }) => {
    const me = await registerStudent(request, "pay-fail");
    await login(page, me.email, me.password);
    await page.waitForURL(/\/ogrenci/);
    await page.goto("/ogrenci/paketler");
    await page.locator("article", { hasText: "1 Aylık Paket" }).getByRole("button", { name: "Satın al" }).click();
    await page.waitForURL(/\/odeme\/sahte\/mock_/);
    await page.getByRole("button", { name: "Ödemeyi başarısız say" }).click();
    await page.waitForURL(/\/ogrenci\/odemeler\?odeme=/);
    await expect(page.getByText("Ödeme tamamlanamadı.")).toBeVisible();
    await expect(page.locator('a:has-text("Belgeyi aç")')).toHaveCount(0);
  });
});

test.describe("admin finans", () => {
  test("finans özeti, paket yönetimi ve komisyon", async ({ page }) => {
    await login(page, DEMO.admin.email, DEMO.admin.password);
    await page.waitForURL(/\/admin/);

    await page.goto("/admin/odemeler");
    await expect(page.locator("main")).toContainText("Net tahsilat");
    await expect(page.locator("main")).toContainText("Platform komisyonu");

    await page.goto("/admin/paketler");
    const name = `E2E Paket ${Date.now()}`;
    await page.locator("#name-new").fill(name);
    await page.locator("#count-new").fill("4");
    await page.locator("#months-new").fill("1");
    await page.locator("#price-new").fill("1.250,50");
    await page.getByRole("button", { name: "Paketi ekle" }).click();
    await page.waitForSelector("text=Kaydedildi.");
    await page.reload();
    const row = page.locator("li", { hasText: name });
    await expect(row).toContainText("₺1.250,50"); // kuruş yuvarlanmadan gösterilir
    await row.getByRole("button", { name: "Satıştan kaldır" }).click();
  });
});
