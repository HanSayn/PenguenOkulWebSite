import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

test.describe("herkese açık site", () => {
  test("ana sayfa, SSS ve gizlilik sayfaları açılır", async ({ page }) => {
    for (const path of ["/", "/sss", "/gizlilik", "/giris", "/kayit"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
    }
    await expect(page).toHaveTitle(/Penguen Okul/);
  });

  test("olmayan sayfa özel 404 gösterir", async ({ page }) => {
    const res = await page.goto("/yok-boyle-bir-sayfa");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Aradığın sayfa bulunamadı")).toBeVisible();
  });

  test("güvenlik başlıkları ve robots.txt", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
  });

  test("mobil görünümde yatay taşma yok", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true });
    const page = await ctx.newPage();
    for (const path of ["/", "/giris", "/kayit", "/sss"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await ctx.close();
  });
});

test.describe("erişim denetimi", () => {
  test("girişsiz kullanıcı panellerden giriş sayfasına yönlenir", async ({ page }) => {
    for (const path of ["/ogrenci", "/ogretmen", "/admin", "/ogrenci/odemeler"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/giris/);
    }
  });

  test("öğrenci öğretmen ve admin alanına giremez", async ({ page }) => {
    await login(page, DEMO.student.email, DEMO.student.password);
    await page.waitForURL(/\/ogrenci/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/ogrenci/);
    await page.goto("/ogretmen/kazanc");
    await expect(page).toHaveURL(/\/ogrenci/);
  });

  test("üç rolün paneli açılır", async ({ browser }) => {
    for (const [role, home] of [["student", "/ogrenci"], ["teacher", "/ogretmen"], ["admin", "/admin"]] as const) {
      const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
      const page = await ctx.newPage();
      await login(page, DEMO[role].email, DEMO[role].password);
      await page.waitForURL(new RegExp(home));
      await expect(page.locator("main")).toBeVisible();
      await ctx.close();
    }
  });
});
