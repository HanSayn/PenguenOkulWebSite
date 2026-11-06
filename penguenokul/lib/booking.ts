import { prisma } from "@/lib/prisma";
import { addDays, istanbulDate, toHHMM, toMinutes, weekdayOf, ymdIstanbul } from "@/lib/format";

export const SLOT_MINUTES = 60;
export const MIN_LEAD_HOURS = 2; // en erken, şu andan 2 saat sonrasına ders alınabilir
export const BOOKING_HORIZON_DAYS = 14;

// Aktif derslerde "teacherId|başlangıç" yazılır, iptal/ret/süre dolumunda null yapılır.
// Lesson.slotKey unique olduğu için aynı saate ikinci talep veritabanı seviyesinde reddedilir.
export const slotKeyFor = (teacherId: string, startsAt: Date) => `${teacherId}|${startsAt.toISOString()}`;

type AvailabilityRow = {
  dayOfWeek: number | null;
  specificDate: Date | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};

// Öğretmenin önümüzdeki BOOKING_HORIZON_DAYS gün içindeki boş saatleri (artan sırada).
export async function getOpenSlots(teacherId: string, now = new Date()): Promise<Date[]> {
  const earliest = new Date(now.getTime() + MIN_LEAD_HOURS * 3600_000);
  const today = ymdIstanbul(now);
  const lastDay = addDays(today, BOOKING_HORIZON_DAYS);

  const [rows, booked] = await Promise.all([
    prisma.availability.findMany({ where: { teacherId } }) as Promise<AvailabilityRow[]>,
    prisma.lesson.findMany({
      where: {
        teacherId,
        slotKey: { not: null },
        scheduledAt: { gte: earliest, lt: istanbulDate(lastDay, "00:00") },
      },
      select: { scheduledAt: true },
    }) as Promise<{ scheduledAt: Date }[]>,
  ]);

  const taken = new Set(booked.map((l) => l.scheduledAt.getTime()));
  const slots = new Map<number, Date>();

  for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
    const ymd = addDays(today, i);
    const dow = weekdayOf(ymd);

    for (const row of rows) {
      const applies = row.isRecurring
        ? row.dayOfWeek === dow
        : row.specificDate !== null && ymdIstanbul(row.specificDate) === ymd;
      if (!applies) continue;

      const end = toMinutes(row.endTime);
      for (let m = toMinutes(row.startTime); m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
        const startsAt = istanbulDate(ymd, toHHMM(m));
        const t = startsAt.getTime();
        if (startsAt < earliest || taken.has(t)) continue;
        slots.set(t, startsAt);
      }
    }
  }

  return [...slots.values()].sort((a, b) => a.getTime() - b.getTime());
}

// Öğrenci şu an deneme dersi ya da paket hakkıyla talep gönderebilir mi?
// requestLessonAction ile aynı kuralları uygular (orada tekrar doğrulanır).
export async function getEntitlements(studentId: string, hasUsedTrial: boolean) {
  const [activeTrial, purchases] = await Promise.all([
    prisma.lesson.findFirst({
      where: { studentId, isTrial: true, status: { in: ["REQUESTED", "CONFIRMED", "COMPLETED", "NO_SHOW"] } },
      select: { id: true },
    }),
    prisma.purchase.findMany({
      where: { studentId, remainingLessons: { gt: 0 }, expiresAt: { gt: new Date() } },
      include: { _count: { select: { lessons: { where: { status: "REQUESTED" } } } } },
    }) as Promise<{ remainingLessons: number; _count: { lessons: number } }[]>,
  ]);

  return {
    canTrial: !hasUsedTrial && !activeTrial,
    canPackage: purchases.some((p) => p.remainingLessons - p._count.lessons > 0),
  };
}
