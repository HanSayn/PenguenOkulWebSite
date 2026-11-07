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

  test("CSP: nonce'lu, unsafe-inline yok, hiçbir sayfada ihlal ya da bozulma yok", async ({ page, request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    const nonce = /'nonce-([^']+)'/.exec(script)?.[1];
    expect(nonce).toBeTruthy();
    expect(script).not.toContain("unsafe-inline");
    // Next'in kendi betikleri aynı nonce ile işaretlenmiş olmalı
    const html = await res.text();
    expect(html).toContain(`nonce="${nonce}"`);
    // Her istekte farklı nonce
    const again = (await request.get("/")).headers()["content-security-policy"];
    expect(again).not.toBe(csp);

    const violations: string[] = [];
    page.on("console", (m) => { if (/content security policy|refused to (execute|load)/i.test(m.text())) violations.push(m.text()); });
    page.on("pageerror", (e) => violations.push(String(e)));
    for (const path of ["/", "/giris", "/kayit", "/sss", "/gizlilik", "/sifremi-unuttum"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    // Sayfa gerçekten etkileşimli (hidrasyon çalıştı): hatalı girişte sunucu eylemi sonucu görünür
    await page.goto("/giris");
    await page.locator("#email").fill(`csp-${Date.now()}@e2e.test`);
    await page.locator("#password").fill("yanlis-sifre-1");
    await page.locator("button[type=submit]").click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    expect(violations).toEqual([]);
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
