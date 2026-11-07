import { expect, test, type Page } from "@playwright/test";
import { DEMO, loginIn, registerStudent } from "./helpers";

// Demo öğretmenin profil sayfasını açar ve ilk boş saati seçer.
async function openTeacherAndPickFirstSlot(page: Page) {
  await page.goto("/ogrenci/ders-al");
  await page.locator('a[href^="/ogrenci/ders-al/"]').first().click();
  await page.waitForURL(/\/ogrenci\/ders-al\/.+/);
  const firstSlot = page.locator('input[name="slot"]').first();
  await expect(firstSlot).toBeAttached();
  const value = await firstSlot.getAttribute("value");
  // Kullanıcı etikete tıklar; radyo düğmesi görsel olarak etiketin içinde gizlidir
  await page.locator('label:has(input[name="slot"])').first().click();
  await expect(firstSlot).toBeChecked();
  return value!;
}

test.describe("tam rezervasyon akışı", () => {
  test("öğrenci talep eder, öğretmen onaylar, deneme hakkı tükenir", async ({ browser, request }) => {
    const name = `Rezervasyon ${Date.now()}`;
    const me = await registerStudent(request, "book", name);
    const stu = await loginIn(browser, me.email, me.password);
    const tea = await loginIn(browser, DEMO.teacher.email, DEMO.teacher.password);

    // 1) talep
    await openTeacherAndPickFirstSlot(stu.page);
    await stu.page.getByRole("button", { name: "Ders talebi gönder" }).click();
    await stu.page.waitForURL(/\/ogrenci\/derslerim\?talep=ok/);
    await expect(stu.page.locator("main")).toContainText("Onay bekliyor");

    // 2) öğretmen talebi görür ve onaylar
    await tea.page.goto("/ogretmen/talepler");
    const row = tea.page.locator("li", { hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Onayla" }).click();
    await expect(tea.page.locator("li", { hasText: name })).toHaveCount(0);

    // 3) öğrenci onayı görür ve bildirim alır
    await stu.page.goto("/ogrenci/derslerim");
    await expect(stu.page.locator("main")).toContainText("Onaylandı");
    await stu.page.goto("/ogrenci/bildirimler");
    await expect(stu.page.locator("main")).toContainText(/onaylandı/i);

    // 4) deneme hakkı bir kez: paketi yoksa yeni talep açılamaz
    await stu.page.goto("/ogrenci/ders-al");
    await stu.page.locator('a[href^="/ogrenci/ders-al/"]').first().click();
    await expect(stu.page.locator("main")).toContainText("deneme dersi ya da paket hakkın olması gerekiyor");

    await stu.ctx.close();
    await tea.ctx.close();
  });

  test("aynı saate ikinci talep reddedilir (çifte rezervasyon yok)", async ({ browser, request }) => {
    const a = await registerStudent(request, "dbl-a", `Çift A ${Date.now()}`);
    const b = await registerStudent(request, "dbl-b", `Çift B ${Date.now()}`);
    const sa = await loginIn(browser, a.email, a.password);
    const sb = await loginIn(browser, b.email, b.password);

    // İkisi de aynı anda aynı saati seçer
    const slotA = await openTeacherAndPickFirstSlot(sa.page);
    const slotB = await openTeacherAndPickFirstSlot(sb.page);
    expect(slotA).toBe(slotB);

    await sa.page.getByRole("button", { name: "Ders talebi gönder" }).click();
    await sa.page.waitForURL(/\/ogrenci\/derslerim\?talep=ok/);

    await sb.page.getByRole("button", { name: "Ders talebi gönder" }).click();
    await expect(sb.page.locator("p[role=alert]")).toBeVisible();
    await expect(sb.page).not.toHaveURL(/talep=ok/);

    // B'nin deneme hakkı yanmadı: sayfayı yenileyince başka saat seçebilir
    await sb.page.reload();
    const next = sb.page.locator('input[name="slot"]').first();
    await expect(next).toBeAttached();
    expect(await next.getAttribute("value")).not.toBe(slotA);

    await sa.ctx.close();
    await sb.ctx.close();
  });
});
