import { prisma, type Tx } from "@/lib/prisma";
import { recordEarning } from "@/lib/earnings";
import { sendSms } from "@/lib/sms";
import { TIMEOUT_REASON } from "@/lib/payments/constants";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";
import { formatDateTime, formatDay } from "@/lib/format";

// Tüm zamanlanmış işler tek yerde ve idempotent: art arda ya da gecikmeli çalışması zarar vermez.
// Tetikleme: GET/POST /api/cron/run (CRON_SECRET ile) veya `npm run jobs`. Önerilen sıklık: 5 dakika.

const MIN = 60_000;
const BATCH = 200;

export type JobReport = {
  expiredRequests: number;
  reminders: number;
  packageWarnings: number;
  completedLessons: number;
  expiredPayments: number;
  purgedRateLimits: number;
};

// ───────────── 1) Yanıtsız talepleri iptal et ─────────────

async function expireStaleRequests(now: Date): Promise<number> {
  const stale = (await prisma.lesson.findMany({
    where: {
      status: "REQUESTED",
      OR: [{ request: { is: { expiresAt: { lte: now } } } }, { scheduledAt: { lte: now } }],
    },
    select: {
      id: true,
      scheduledAt: true,
      teacher: { select: { name: true } },
      student: { select: { userId: true } },
    },
    take: BATCH,
  })) as { id: string; scheduledAt: Date; teacher: { name: string }; student: { userId: string } }[];

  let count = 0;
  for (const l of stale) {
    // Koşullu güncelleme: öğretmen aynı anda onayladıysa (status artık REQUESTED değil) dokunma
    const res = await prisma.lesson.updateMany({
      where: { id: l.id, status: "REQUESTED" },
      data: { status: "EXPIRED", slotKey: null }, // saat tekrar müsait olur
    });
    if (res.count === 0) continue;
    count++;

    // Hak talep anında düşmediği için iade gerekmez (Faz 2/3 kuralı)
    await notifyUser({
      userId: l.student.userId,
      type: "LESSON_EXPIRED",
      title: "Ders talebin yanıtlanmadı",
      body: `${l.teacher.name}, ${formatDateTime(l.scheduledAt)} tarihli talebini zamanında yanıtlamadı. Başka bir saat ya da öğretmen deneyebilirsin.`,
      dedupeKey: `expired:${l.id}`,
      ctaPath: "/ogrenci/ders-al",
      ctaLabel: "Yeni ders al",
    });
  }
  return count;
}

// ───────────── 2) Ders hatırlatmaları ─────────────

// Her hatırlatma kendi penceresinde gönderilir: (şimdi + alt sınır, şimdi + üst sınır].
// Böylece iş bir süre çalışmamış olsa bile "24 saat kaldı" bildirimi dersin 30 dk öncesinde gitmez.
const REMINDERS = [
  { kind: "24h", minutes: 24 * 60, lower: 60, title: "Dersin 24 saat içinde başlıyor", email: true },
  { kind: "1h", minutes: 60, lower: 15, title: "Dersin 1 saat içinde başlıyor", email: true },
  { kind: "15m", minutes: 15, lower: 0, title: "Dersin 15 dakika içinde başlıyor", email: false },
] as const;

type ReminderLesson = {
  id: string;
  scheduledAt: Date;
  request: { respondedAt: Date | null } | null;
  student: { userId: string; name: string; phone: string | null; smsConsent: boolean };
  teacher: { userId: string; name: string };
};

async function sendLessonReminders(now: Date): Promise<number> {
  let sent = 0;

  for (const r of REMINDERS) {
    const lessons = (await prisma.lesson.findMany({
      where: {
        status: "CONFIRMED",
        scheduledAt: {
          gt: new Date(now.getTime() + r.lower * MIN),
          lte: new Date(now.getTime() + r.minutes * MIN),
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        request: { select: { respondedAt: true } },
        student: { select: { userId: true, name: true, phone: true, smsConsent: true } },
        teacher: { select: { userId: true, name: true } },
      },
      take: BATCH,
    })) as ReminderLesson[];

    for (const l of lessons) {
      // Ders, hatırlatma anından sonra onaylandıysa (ör. yarınki dersi 5 saat kala onayladı) "24 saat" bildirimi anlamsız
      const remindAt = l.scheduledAt.getTime() - r.minutes * MIN;
      if (l.request?.respondedAt && l.request.respondedAt.getTime() > remindAt) continue;

      const when = formatDateTime(l.scheduledAt);
      const targets = [
        { userId: l.student.userId, body: `${l.teacher.name} ile dersin ${when} tarihinde.`, path: "/ogrenci/derslerim" },
        { userId: l.teacher.userId, body: `${l.student.name} ile dersin ${when} tarihinde.`, path: "/ogretmen/takvim" },
      ];

      for (const t of targets) {
        const created = await notifyUser({
          userId: t.userId,
          type: "LESSON_REMINDER",
          title: r.title,
          body: t.body,
          dedupeKey: `reminder:${r.kind}:${l.id}:${t.userId}`,
          email: r.email,
          ctaPath: t.path,
          ctaLabel: "Derslerime git",
        });
        if (created) sent++;
        // SMS yalnızca açık rızası olan öğrenciye ve yalnızca "1 saat kala" hatırlatmasında; bildirim idempotent olduğundan tek kez gider
        if (created && r.kind === "1h" && t.userId === l.student.userId && l.student.smsConsent && l.student.phone) {
          await sendSms(l.student.phone, `Penguen Okul: ${l.teacher.name} ile dersin 1 saat içinde (${formatDateTime(l.scheduledAt)}).`);
        }
      }
    }
  }
  return sent;
}

// ───────────── 3) Paket bitiş uyarısı ─────────────

const PACKAGE_WARNING_DAYS = 7;

async function warnExpiringPackages(now: Date): Promise<number> {
  const soon = new Date(now.getTime() + PACKAGE_WARNING_DAYS * 24 * 60 * MIN);

  const purchases = (await prisma.purchase.findMany({
    where: { remainingLessons: { gt: 0 }, expiresAt: { gt: now, lte: soon } },
    select: {
      id: true,
      remainingLessons: true,
      expiresAt: true,
      student: { select: { userId: true } },
    },
    take: BATCH,
  })) as { id: string; remainingLessons: number; expiresAt: Date; student: { userId: string } }[];

  let count = 0;
  for (const p of purchases) {
    const created = await notifyUser({
      userId: p.student.userId,
      type: "PACKAGE_EXPIRING",
      title: "Paketinin süresi dolmak üzere",
      body: `${p.remainingLessons} ders hakkın ${formatDay(p.expiresAt)} tarihinde sona eriyor. Kullanmak için yeni ders talebi gönderebilirsin.`,
      dedupeKey: `package-expiring:${p.id}`,
      ctaPath: "/ogrenci/ders-al",
      ctaLabel: "Ders al",
    });
    if (created) count++;
  }
  return count;
}

// ───────────── 4) Biten dersleri tamamla ─────────────

const COMPLETE_GRACE_MIN = 30; // ders bittikten sonra, admin işaretlemezse otomatik "tamamlandı"

// Katılım olmadığı bildirilmeyen dersler yapılmış sayılır. Admin, Dersler sayfasından
// "Katılım olmadı" olarak düzeltebilir. Değerlendirme (Review) bu durumdan sonra açılabilir.
async function completePastLessons(now: Date): Promise<number> {
  const candidates = (await prisma.lesson.findMany({
    where: { status: "CONFIRMED", scheduledAt: { lte: new Date(now.getTime() - COMPLETE_GRACE_MIN * MIN) } },
    select: { id: true, scheduledAt: true, durationMin: true },
    take: BATCH,
  })) as { id: string; scheduledAt: Date; durationMin: number }[];

  const due = candidates
    .filter((l) => l.scheduledAt.getTime() + (l.durationMin + COMPLETE_GRACE_MIN) * MIN <= now.getTime())
    .map((l) => l.id);
  if (due.length === 0) return 0;

  // Ders ve kazanç kaydı aynı işlemde yazılır: biri olup diğeri olmaz
  let completed = 0;
  for (const id of due) {
    await prisma.$transaction(async (tx: Tx) => {
      const res = await tx.lesson.updateMany({ where: { id, status: "CONFIRMED" }, data: { status: "COMPLETED" } });
      if (res.count === 1) {
        await recordEarning(tx, id);
        completed++;
      }
    });
  }
  return completed;
}

// ───────────── Yarım kalan ödemeleri kapat ─────────────

const PAYMENT_TIMEOUT_MIN = 120;

// Kullanıcı ödeme sayfasından dönmediyse işlem sonsuza dek "bekliyor" kalmasın.
// Koşullu güncelleme: bu sırada webhook ödemeyi tamamladıysa dokunulmaz.
async function expirePendingPayments(now: Date): Promise<number> {
  const res = await prisma.payment.updateMany({
    where: { status: "PENDING", createdAt: { lte: new Date(now.getTime() - PAYMENT_TIMEOUT_MIN * MIN) } },
    data: { status: "FAILED", failureReason: `${TIMEOUT_REASON}: ödeme tamamlanmadı` },
  });
  return res.count;
}

// ───────────── Giriş noktası ─────────────

export async function runScheduledJobs(now = new Date()): Promise<JobReport> {
  // Sıra önemli değil ama biri hata verirse diğerleri yine de çalışsın
  const settle = async (name: string, job: () => Promise<number>) => {
    try {
      return await job();
    } catch (err) {
      console.error(`[jobs] ${name} başarısız`, err);
      return 0;
    }
  };

  const expiredRequests = await settle("expireStaleRequests", () => expireStaleRequests(now));
  const reminders = await settle("sendLessonReminders", () => sendLessonReminders(now));
  const packageWarnings = await settle("warnExpiringPackages", () => warnExpiringPackages(now));
  const completedLessons = await settle("completePastLessons", () => completePastLessons(now));
  const expiredPayments = await settle("expirePendingPayments", () => expirePendingPayments(now));

  const purgedRateLimits = await settle("purgeExpiredRateLimits", () => purgeExpiredRateLimits(now));

  return { expiredRequests, reminders, packageWarnings, completedLessons, expiredPayments, purgedRateLimits };
}
