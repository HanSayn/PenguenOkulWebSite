// Çalıştır: npx prisma db seed
// Idempotent: tekrar çalıştırmak kayıt çoğaltmaz.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@penguenokul.local").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345";
const DEMO_PASSWORD = "Demo12345";

const subjects: { name: string; slug: string; topics: string[] }[] = [
  { name: "Matematik", slug: "matematik", topics: ["Temel Kavramlar", "Fonksiyonlar", "Türev", "İntegral", "Olasılık"] },
  { name: "Fizik", slug: "fizik", topics: ["Hareket", "Kuvvet ve Newton Yasaları", "Elektrik", "Optik"] },
  { name: "Kimya", slug: "kimya", topics: ["Atom ve Periyodik Sistem", "Mol Kavramı", "Asit-Baz"] },
  { name: "Biyoloji", slug: "biyoloji", topics: ["Hücre", "Kalıtım", "Sistemler"] },
  { name: "Türkçe", slug: "turkce", topics: ["Paragraf", "Dil Bilgisi", "Yazım ve Noktalama"] },
  { name: "İngilizce", slug: "ingilizce", topics: ["Grammar", "Vocabulary", "Reading"] },
];

// Fiyatlar örnek değerdir (kuruş cinsinden); gerçek fiyatları admin panelinden belirle.
const packages = [
  { id: "pkg-1ay", name: "1 Aylık Paket", lessonCount: 8, durationMonths: 1, price: 240000 },
  { id: "pkg-3ay", name: "3 Aylık Paket", lessonCount: 24, durationMonths: 3, price: 660000 },
  { id: "pkg-6ay", name: "6 Aylık Paket", lessonCount: 48, durationMonths: 6, price: 1200000 },
];

const settings: Record<string, string> = {
  cancelWindowHours: "12", // öğrenci derse kaç saat kalana kadar iptal edebilir
  defaultCommissionRate: "0.2",
  trialLessonMinutes: "30",
  requestExpiryHours: "24",
  meetingLinkOpensMinutesBefore: "15",
};

async function main() {
  // Admin
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, passwordHash: adminHash, role: "ADMIN" },
  });

  // Dersler ve konular
  for (const s of subjects) {
    const subject = await prisma.subject.upsert({
      where: { slug: s.slug },
      update: { name: s.name },
      create: { name: s.name, slug: s.slug },
    });
    const existing = await prisma.topic.findMany({
      where: { subjectId: subject.id },
      select: { name: true },
    });
    const have = new Set(existing.map((t: { name: string }) => t.name));
    const missing = s.topics.filter((t) => !have.has(t));
    if (missing.length) {
      await prisma.topic.createMany({
        data: missing.map((name) => ({ name, subjectId: subject.id })),
      });
    }
  }

  // Paketler
  for (const p of packages) {
    await prisma.package.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  // Ayarlar
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // Demo kullanıcılar (yalnızca geliştirme)
  if (process.env.NODE_ENV !== "production") {
    const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const matematik = await prisma.subject.findUnique({ where: { slug: "matematik" } });

    await prisma.user.upsert({
      where: { email: "ogretmen@penguenokul.local" },
      update: {},
      create: {
        email: "ogretmen@penguenokul.local",
        passwordHash: demoHash,
        role: "TEACHER",
        teacher: {
          create: {
            name: "Demo Öğretmen",
            bio: "Matematik öğretmeni (örnek profil).",
            status: "ACTIVE",
            hourlyRate: 40000,
            subjects: matematik ? { create: [{ subjectId: matematik.id }] } : undefined,
          },
        },
      },
    });

    await prisma.user.upsert({
      where: { email: "ogrenci@penguenokul.local" },
      update: {},
      create: {
        email: "ogrenci@penguenokul.local",
        passwordHash: demoHash,
        role: "STUDENT",
        student: { create: { name: "Demo Öğrenci", grade: "12", targetExam: "YKS" } },
      },
    });

    // Demo öğretmen: hafta içi 18-22, cumartesi 10-16 (yalnızca hiç müsaitliği yoksa)
    const demoTeacher = await prisma.teacherProfile.findFirst({
      where: { user: { email: "ogretmen@penguenokul.local" } },
    });
    if (demoTeacher && (await prisma.availability.count({ where: { teacherId: demoTeacher.id } })) === 0) {
      await prisma.availability.createMany({
        data: [
          ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({
            teacherId: demoTeacher.id, dayOfWeek, startTime: "18:00", endTime: "22:00", isRecurring: true,
          })),
          { teacherId: demoTeacher.id, dayOfWeek: 6, startTime: "10:00", endTime: "16:00", isRecurring: true },
        ],
      });
    }

    // Paket satın alma ekranı henüz yok; akışı denemek için demo öğrenciye hazır bir paket ver
    const demoStudent = await prisma.studentProfile.findFirst({
      where: { user: { email: "ogrenci@penguenokul.local" } },
    });
    if (demoStudent && (await prisma.purchase.count({ where: { studentId: demoStudent.id } })) === 0) {
      const demoPurchase = await prisma.purchase.create({
        data: {
          studentId: demoStudent.id,
          packageId: "pkg-1ay",
          remainingLessons: 8,
          expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
          unitPrice: 30000, // 2.400 TL / 8 ders
        },
      });
      // Demo satın almanın ödeme kaydı ve belgesi (sahte sağlayıcı)
      const demoPayment = await prisma.payment.create({
        data: {
          studentId: demoStudent.id,
          packageId: "pkg-1ay",
          purchaseId: demoPurchase.id,
          amount: 240000,
          status: "PAID",
          provider: "mock",
          providerRef: "mock_seed_demo",
          paidAt: new Date(),
        },
      });
      await prisma.invoice.create({
        data: { paymentId: demoPayment.id, invoiceNumber: `PO-${new Date().getFullYear()}-000001`, buyerName: demoStudent.name, description: "1 Aylık Paket (8 ders)" },
      });
      await prisma.counter.upsert({ where: { key: `invoice-${new Date().getFullYear()}` }, create: { key: `invoice-${new Date().getFullYear()}`, value: 1 }, update: {} });
    }

    // Öğrenci takibi ve mesajlaşmayı hemen denemek için: demo çift arasında geçmişte yapılmış bir ders
    if (
      demoTeacher &&
      demoStudent &&
      (await prisma.lesson.count({ where: { teacherId: demoTeacher.id, studentId: demoStudent.id } })) === 0
    ) {
      const demoPurchase = await prisma.purchase.findFirst({ where: { studentId: demoStudent.id } });
      const pastLesson = await prisma.lesson.create({
        data: {
          teacherId: demoTeacher.id,
          studentId: demoStudent.id,
          purchaseId: demoPurchase?.id,
          scheduledAt: new Date(Date.now() - 3 * 24 * 3600_000),
          status: "COMPLETED", // slotKey null: tamamlanmış ders saati kilitlemez
        },
      });
      // Geçmiş paketli ders: hak düşmüş ve kazanç dökümü oluşmuş olmalı (komisyon %20)
      if (demoPurchase) {
        await prisma.purchase.update({ where: { id: demoPurchase.id }, data: { remainingLessons: { decrement: 1 } } });
        await prisma.lessonEarning.create({
          data: { lessonId: pastLesson.id, teacherId: demoTeacher.id, purchaseId: demoPurchase.id, gross: 30000, commissionRate: 0.2, commission: 6000, net: 24000 },
        });
      }
    }
  }

  console.log("Seed tamam.");
  console.log(`  Admin: ${ADMIN_EMAIL}`);
  if (process.env.NODE_ENV !== "production") {
    console.log("  Demo: ogretmen@penguenokul.local / ogrenci@penguenokul.local");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
