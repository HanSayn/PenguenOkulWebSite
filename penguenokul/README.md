# Penguen Okul

Online birebir özel ders platformu. Üç rol: **Öğrenci**, **Öğretmen**, **Admin**. Müsaitlik, ödeme, komisyon dağılımı ve hak ediş sistem tarafından yönetilir; öğrenci ve öğretmen yalnızca ders yapar.

Next.js 14 (App Router) · TypeScript · Prisma + PostgreSQL · NextAuth v5 · CSS Modules

## Kurulum

```bash
npm install
cp .env.example .env          # AUTH_SECRET üret: openssl rand -base64 32
docker compose up -d          # yerel PostgreSQL (ya da .env içindeki DATABASE_URL'i kendi veritabanına yönlendir)
npx prisma migrate dev --name init
npx prisma db seed            # demo hesaplar ve örnek veri
npm run dev                   # http://localhost:3000
```

Demo hesaplar: `admin@penguenokul.local` / `Admin12345`, `ogretmen@penguenokul.local` ve `ogrenci@penguenokul.local` / `Demo12345`.

E-posta gönderimi için `SMTP_*` boşsa bağlantılar (şifre sıfırlama vb.) sunucu konsoluna yazılır.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` / `build` / `start` | Geliştirme, derleme, canlı mod |
| `npm run typecheck` / `npm run lint` | Tip ve stil denetimi |
| `npm test` | Birim testleri (Vitest) |
| `npm run test:e2e` | Tarayıcı testleri (Playwright). Önce `npm run build && npm start` ve `npx prisma db seed`; canlı modda test ödemesi için `.env`'de `ALLOW_MOCK_PAYMENTS="true"` |
| `npm run jobs` | Zamanlanmış işleri elle çalıştırır |
| `npm run db:migrate` / `db:deploy` | Geliştirmede migration üretir / canlıda uygular |

## Canlıya alma kontrol listesi

1. **Veritabanı:** yönetilen PostgreSQL (Neon, Supabase, Railway…). `DATABASE_URL`'i ayarla, `npm run db:deploy` ile tabloları oluştur. `db seed` çalıştırma ya da yalnızca bir admin hesabı oluştur; demo şifrelerini canlıda kullanma.
2. **Ortam değişkenleri:** `.env.example` içindeki hepsi. `AUTH_SECRET` yeni üretilmeli, `APP_URL` gerçek alan adı olmalı.
3. **Ödeme:** `PAYMENT_PROVIDER` ve sağlayıcı anahtarları. Test ödemesi canlıda kapalıdır (`ALLOW_MOCK_PAYMENTS` boş bırak). Gerçek sağlayıcı bağlanmadan canlıya para alınamaz.
4. **Zamanlanmış işler:** 5 dakikada bir `GET /api/cron/run` (`Authorization: Bearer $CRON_SECRET`). Vercel Cron ya da harici bir zamanlayıcı kullanılabilir. Hatırlatmalar, süresi dolan talepler, otomatik ders tamamlama ve hız sınırı temizliği buna bağlıdır.
5. **E-posta:** SMTP bilgilerini gir (Resend, Brevo vb.).
6. **Ters vekil:** hız sınırları istemci adresini `x-forwarded-for`'dan okur. Vercel/nginx gibi bir vekil arkasında çalıştır.
7. **Yasal:** gizlilik/KVKK metni (`/gizlilik`) taslaktır, hukuk danışmanıyla tamamla. Ödeme belgesi yasal e-Arşiv faturası değildir; mali müşavirle netleştir.

## Yapı

- `app/` rol bazlı sayfalar (`ogrenci`, `ogretmen`, `admin`), herkese açık sayfalar, `api/` (kayıt, ödeme webhook'u, fatura PDF, cron, KVKK dışa aktarma)
- `lib/` iş mantığı: rezervasyon (`booking`), ödeme (`payments/`, `payment-actions`), hak ediş (`earnings`, `payout-actions`), görüşme (`meeting/`), SMS (`sms/`), hız sınırı, KVKK (`account-data`), zamanlanmış işler (`jobs`)
- `prisma/` şema ve seed · `tests/` birim ve tarayıcı testleri

Para tutarları kuruş cinsinden `Int` saklanır. Saat dilimi İstanbul'a (UTC+3) sabittir.
