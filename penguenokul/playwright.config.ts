import { defineConfig } from "@playwright/test";

// Çalıştırma:  npm run build && npm start   (ayrı terminalde)   →   npm run test:e2e
// Önce `npx prisma db seed` ile demo verileri yükle. Test ödeme sayfası için ALLOW_MOCK_PAYMENTS="true" gerekir (canlı modda).
// BASE_URL ile başka bir adres verilebilir.
const baseURL = process.env.BASE_URL || "http://localhost:3000";

// Hız sınırları adres başınadır; her koşu rastgele bir adresle çalışır ki tekrarlı koşular birbirini engellemesin.
const r = () => Math.floor(Math.random() * 250) + 1;
const fakeIp = `10.${r()}.${r()}.${r()}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp }, locale: "tr-TR", timezoneId: "Europe/Istanbul" },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: baseURL, reuseExistingServer: true, timeout: 300_000 },
});
