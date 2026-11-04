# 🐧 Penguen Okul — Uygulama Geliştirme Planı

## Tech Stack

| Katman | Teknoloji | Gerekçe |
|--------|-----------|---------|
| **Framework** | Next.js 14 (App Router) + TypeScript | SSR, file-based routing, API routes tek çatı altında |
| **Styling** | CSS Modules + Global CSS | Vanilla CSS, component-scoped, özel tasarım |
| **Database** | PostgreSQL + Prisma ORM | İlişkisel yapı, Prisma tip güvenliği sağlar |
| **Auth** | NextAuth.js v5 (JWT + Session) | Multi-role, email/şifre, 2FA (Admin için) |
| **Scheduling** | `node-cron` veya Vercel Cron Jobs | Zamanlanmış işler (link aktivasyonu, süresi dolan talepler) |
| **Email** | Nodemailer + SMTP (Resend/Brevo) | Bildirimler, şifre sıfırlama |
| **File Upload** | UploadThing veya local | Öğretmen fotoğrafı, fatura PDF |
| **PDF** | `@react-pdf/renderer` | Fatura oluşturma |
| **Ödeme** | Yer tutucu (iyzico / Stripe hazır adapter) | Sonradan bağlanacak |
| **Görüşme** | Yer tutucu (Jitsi / Zoom link) | Sonradan bağlanacak |
| **Test** | Jest + Playwright | Kritik akış testleri |

---

## Proje Yapısı

```
penguenokul/
├── app/
│   ├── (auth)/
│   │   ├── giris/               # Login
│   │   ├── kayit/               # Register (ogrenci / ogretmen seçimi)
│   │   └── sifremi-unuttum/     # Password reset
│   ├── ogrenci/
│   │   ├── layout.tsx           # Student shell + nav
│   │   ├── page.tsx             # Dashboard
│   │   ├── ders-al/             # Browse + book lessons
│   │   ├── derslerim/           # My lessons list
│   │   ├── paketler/            # Purchase packages
│   │   ├── odemeler/            # Payment history + invoices
│   │   └── profil/
│   ├── ogretmen/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Dashboard
│   │   ├── talepler/            # Pending lesson requests
│   │   ├── takvim/              # Availability + upcoming lessons
│   │   ├── ogrencilerim/        # Student tracking
│   │   ├── kazanc/              # Earnings + payouts
│   │   ├── mesajlar/            # Messaging
│   │   └── profil/
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Dashboard stats
│   │   ├── ogretmenler/         # Teacher management + approvals
│   │   ├── ogrenciler/          # Student management
│   │   ├── dersler/             # All lessons
│   │   ├── paketler/            # Package pricing
│   │   ├── odemeler/            # Finance
│   │   ├── destek/              # Support tickets
│   │   ├── raporlar/            # Reports + CSV export
│   │   ├── icerik/              # Announcements, FAQ
│   │   └── ayarlar/             # System settings
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── ogrenci/
│   │   ├── ogretmen/
│   │   └── admin/
│   └── page.tsx                 # Landing page
├── components/
│   ├── ui/                      # Button, Input, Modal, Badge, etc.
│   ├── layout/                  # Sidebar, Topbar, Breadcrumb
│   ├── calendar/                # Availability + booking calendar
│   ├── lessons/                 # Lesson card, status badge
│   └── charts/                  # Dashboard charts
├── lib/
│   ├── prisma.ts
│   ├── auth.ts                  # NextAuth config
│   ├── email.ts
│   ├── cron.ts                  # Scheduled jobs
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── styles/
    ├── globals.css
    └── tokens.css               # Design tokens
```

---

## Veri Modeli (Prisma Schema Özeti)

```prisma
User          id, email, passwordHash, role (STUDENT|TEACHER|ADMIN)
StudentProfile  userId, name, phone, grade, targetExam, parentName, parentPhone
TeacherProfile  userId, name, bio, ösymScore, photo, status (PENDING|ACTIVE|SUSPENDED), commissionRate
Subject       id, name, slug
Topic         id, name, subjectId
Availability  id, teacherId, dayOfWeek|specificDate, startTime, endTime, isRecurring
Lesson        id, studentId, teacherId, topicId, scheduledAt, status, meetingLink, notes
LessonRequest id, lessonId, requestedAt, expiresAt (24h), reason (if rejected)
Package       id, name, lessonCount, durationMonths, price, isActive
Purchase      id, studentId, packageId, purchasedAt, remainingLessons, expiresAt
Payment       id, purchaseId|lessonId, amount, status, providerRef, paidAt
Invoice       id, paymentId, invoiceNumber, pdfUrl, issuedAt
Review        id, lessonId, studentId, teacherId, rating, comment
Message       id, senderId, receiverId, lessonId, content, sentAt, read
Notification  id, userId, type, title, body, isRead, scheduledFor
SupportTicket id, userId, subject, status (OPEN|IN_PROGRESS|CLOSED), messages[]
AuditLog      id, adminId, action, targetType, targetId, before, after, createdAt
Setting       key, value (iptal kuralı, komisyon, deneme ders süresi, vb.)
```

---

## Geliştirme Fazları

### Faz 1 — Temel Altyapı (Öncelik: Yüksek)
- [x] Next.js projesi kur, Prisma + SQLite başlat
- [ ] Design system ve global CSS tokens
- [ ] NextAuth: email/şifre, rol ayrımı, middleware route guard
- [ ] Kayıt formu (öğrenci / öğretmen)
- [ ] Giriş + şifre sıfırlama
- [ ] Landing page
- [ ] Sidebar/layout her rol için

### Faz 2 — Öğrenci Paneli
- [ ] Dashboard (yaklaşan dersler, kalan hak, bildirimler)
- [ ] Eğitmen listesi + profil inceleme
- [ ] Ders saati seçimi (müsaitlik takvimi)
- [ ] Deneme dersi talebi (1 kez)
- [ ] Ders durumu takibi
- [ ] Paket satın alma (yer tutucu ödeme)
- [ ] Ders değerlendirme
- [ ] Ödeme geçmişi + fatura PDF

### Faz 3 — Öğretmen Paneli
- [ ] Dashboard (bugünkü dersler, bekleyen talepler, kazanç)
- [ ] Müsaitlik takvimi (haftalık, tekrarlayan)
- [ ] Gelen ders talepleri (onayla / reddet)
- [ ] Görüşme linki ekleme / sistem üretimi
- [ ] Öğrenci takibi (not, ödev)
- [ ] Kazanç sayfası
- [ ] Mesajlaşma

### Faz 4 — Admin Paneli
- [ ] Dashboard (istatistikler, grafikler)
- [ ] Öğretmen onay/red/askıya al
- [ ] Öğrenci yönetimi
- [ ] Tüm ders yönetimi + manuel işlemler
- [ ] Paket & fiyat yönetimi
- [ ] Ödeme & finans ekranı
- [ ] Destek talepleri
- [ ] Raporlar (CSV export)
- [ ] Sistem ayarları
- [ ] Denetim kaydı (Audit Log)
- [ ] 2FA (Admin girişi)

### Faz 5 — İş Akışları ve Otomasyonlar
- [ ] 24 saat içinde yanıtsız talebi otomatik iptal
- [ ] Ders hatırlatma bildirimi (24h, 1h, 15dk önce)
- [ ] Link aktivasyonu (15dk önce)
- [ ] Süresi dolmuş paket uyarısı
- [ ] E-posta bildirimleri (şablon tabanlı)

### Faz 6 — Yer Tutucular
- [ ] Ödeme adaptörü (iyzico / Stripe interface)
- [ ] Görüşme linki adaptörü (Jitsi / Zoom / Meet)
- [ ] SMS adaptörü

### Faz 7 — Test ve Güvenlik
- [ ] KVKK uyumlu veri işleme (veri silme, dışa aktarma)
- [ ] Jest unit testleri (rezervasyon mantığı, yetki kontrolleri)
- [ ] Playwright e2e testleri (tam rezervasyon akışı)
- [ ] Rate limiting, input sanitization
- [ ] Güvenlik başlıkları (CSP, HSTS)

---

## Kritik İş Kuralları

| Kural | Uygulama |
|-------|----------|
| Aynı saate 2 öğrenci → engel | DB transaction + unique constraint |
| 24h içinde yanıt yok → otomatik iptal | Cron job |
| Link 15dk önce aktif | Cron + conditional render |
| Deneme dersi 1 kez | `hasUsedTrial` flag + DB check |
| Öğrenci iptal X saat öncesine kadar | `Setting.cancelWindowHours` |
| Komisyon şeffaf | Her hesapta göster, ayrı kayıt |
| Admin 2FA | TOTP (otplib) |
| Rol yalıtımı | Middleware + API guard |

---

> [!IMPORTANT]
> Faz 1'den başlanacak. Her faz tamamlanınca sonraki faza geçilecek. Ödeme ve görüşme entegrasyonları gerçek sağlayıcılar bağlanana kadar stub/mock olarak kalacak.
