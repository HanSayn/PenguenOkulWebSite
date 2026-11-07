import { expect, test } from "@playwright/test";
import { login, PASSWORD, registerStudent } from "./helpers";

test.describe("KVKK: verilerim ve hesabım", () => {
  test("veri indirme ve hesap silme", async ({ page, request }) => {
    const me = await registerStudent(request, "kvkk");
    await login(page, me.email, me.password);
    await page.waitForURL(/\/ogrenci/);
    await page.goto("/ogrenci/profil");

    // dışa aktarma
    const res = await page.request.get("/api/hesabim/disa-aktar");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    const text = await res.text();
    expect(JSON.parse(text).account.email).toBe(me.email);
    expect(text).not.toMatch(/passwordHash|\$2[aby]\$/);

    // silme: onay metni ve şifre şart
    await page.locator("summary", { hasText: "Hesabımı sil" }).click();
    await page.locator("#del-password").fill("yanlis-sifre");
    await page.locator("#del-confirm").fill("SİL");
    await page.getByRole("button", { name: "Hesabımı kalıcı olarak sil" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Şifre hatalı");

    await page.locator("#del-password").fill(PASSWORD);
    await page.locator("#del-confirm").fill("sil");
    await page.getByRole("button", { name: "Hesabımı kalıcı olarak sil" }).click();
    await page.waitForURL(/\/\?hesap=silindi/);
    await expect(page.getByText("Hesabın silindi")).toBeVisible();

    // silinen hesapla giriş yapılamaz
    await login(page, me.email, me.password);
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page).toHaveURL(/\/giris/);
  });
});

test.describe("hız sınırı", () => {
  test("art arda hatalı girişte hesap geçici kilitlenir", async ({ page }) => {
    const email = `kilit-${Date.now()}@e2e.test`;
    for (let i = 0; i < 8; i++) {
      await login(page, email, "yanlis-sifre-1");
      await expect(page.locator("p[role=alert]")).toContainText("hatalı");
    }
    await login(page, email, "yanlis-sifre-1");
    await expect(page.locator("p[role=alert]")).toContainText("Çok fazla deneme");
  });
});
