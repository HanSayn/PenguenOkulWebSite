import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "Sifre12345";

export const DEMO = {
  admin: { email: "admin@penguenokul.local", password: "Admin12345" },
  teacher: { email: "ogretmen@penguenokul.local", password: "Demo12345" },
  student: { email: "ogrenci@penguenokul.local", password: "Demo12345" },
};

export async function login(page: Page, email: string, password: string) {
  await page.goto("/giris");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
}

// Her test kendi öğrencisini açar: testler birbirinin verisine bağlı olmaz.
export async function registerStudent(request: APIRequestContext, label: string) {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
  const res = await request.post("/api/kayit", { data: { role: "STUDENT", name: "E2E Öğrenci", email, password: PASSWORD } });
  expect(res.status(), await res.text()).toBe(201);
  return { email, password: PASSWORD };
}
