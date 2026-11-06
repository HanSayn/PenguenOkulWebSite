"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { getNumberSetting } from "@/lib/settings";
import { getOpenSlots, slotKeyFor, SLOT_MINUTES } from "@/lib/booking";
import { ACTIVE_STATUSES, TRIAL_BLOCKING_STATUSES } from "@/lib/relations";

export type RequestLessonState = { error?: string } | undefined;


// Not: Deneme hakkı (hasUsedTrial) ve paket hakkı (remainingLessons) burada TÜKETİLMEZ.
// İkisi de öğretmen onayında düşer (Faz 3). Talep aşamasında yalnızca "hakkı var mı" kontrol edilir,
// böylece ret / süre dolumunda geri alınacak bir durum kalmaz.
export async function requestLessonAction(
  _prev: RequestLessonState,
  formData: FormData
): Promise<RequestLessonState> {
  const { student } = await requireStudent();

  const teacherId = String(formData.get("teacherId") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const topicId = String(formData.get("topicId") ?? "") || null;
  const type = formData.get("type") === "trial" ? "trial" : "package";

  const startsAt = new Date(startsAtRaw);
  if (!teacherId || Number.isNaN(startsAt.getTime())) return { error: "Lütfen bir saat seç." };

  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { subjects: { select: { subjectId: true } } },
  });
  if (!teacher || teacher.status !== "ACTIVE") return { error: "Bu öğretmen şu an ders almıyor." };

  // Saat gerçekten müsait mi? (istemciden gelen değere güvenmiyoruz)
  const open = await getOpenSlots(teacherId);
  if (!open.some((s) => s.getTime() === startsAt.getTime())) {
    return { error: "Bu saat artık müsait değil. Lütfen başka bir saat seç." };
  }

  if (topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { subjectId: true } });
    const teachesIt = topic && teacher.subjects.some((s: { subjectId: string }) => s.subjectId === topic.subjectId);
    if (!teachesIt) return { error: "Seçtiğin konuyu bu öğretmen anlatmıyor." };
  }

  // Öğrencinin aynı saatte başka dersi var mı?
  const clash = await prisma.lesson.findFirst({
    where: { studentId: student.id, scheduledAt: startsAt, status: { in: ACTIVE_STATUSES } },
    select: { id: true },
  });
  if (clash) return { error: "Bu saatte zaten bir dersin var." };

  let purchaseId: string | null = null;
  let durationMin = SLOT_MINUTES;
  const isTrial = type === "trial";

  if (isTrial) {
    if (student.hasUsedTrial) return { error: "Deneme dersi hakkını daha önce kullandın." };
    const activeTrial = await prisma.lesson.findFirst({
      where: { studentId: student.id, isTrial: true, status: { in: TRIAL_BLOCKING_STATUSES } },
      select: { id: true },
    });
    if (activeTrial) return { error: "Zaten bir deneme dersin var." };
    durationMin = await getNumberSetting("trialLessonMinutes", 30);
  } else {
    const purchases = await prisma.purchase.findMany({
      where: { studentId: student.id, remainingLessons: { gt: 0 }, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
      include: { _count: { select: { lessons: { where: { status: "REQUESTED" } } } } },
    });
    // Onay bekleyen talepler de hakkı rezerve etmiş sayılır
    const usable = purchases.find(
      (p: { remainingLessons: number; _count: { lessons: number } }) => p.remainingLessons - p._count.lessons > 0
    );
    if (!usable) return { error: "Kullanılabilir ders hakkın yok. Önce bir paket satın al." };
    purchaseId = usable.id;
  }

  const expiryHours = await getNumberSetting("requestExpiryHours", 24);

  try {
    await prisma.lesson.create({
      data: {
        studentId: student.id,
        teacherId,
        topicId,
        purchaseId,
        scheduledAt: startsAt,
        durationMin,
        status: "REQUESTED",
        isTrial,
        slotKey: slotKeyFor(teacherId, startsAt),
        request: { create: { expiresAt: new Date(Date.now() + expiryHours * 3600_000) } },
      },
    });
  } catch (err) {
    // Aynı anda başka öğrenci bu saati aldıysa unique(slotKey) ihlali oluşur
    if ((err as { code?: string }).code === "P2002") {
      return { error: "Bu saat az önce başka bir öğrenci tarafından alındı." };
    }
    console.error("ders talebi hatası", err);
    return { error: "Talep oluşturulamadı. Biraz sonra tekrar dene." };
  }

  revalidatePath("/ogrenci");
  revalidatePath("/ogrenci/derslerim");
  redirect("/ogrenci/derslerim?talep=ok");
}

export async function completeHomeworkAction(formData: FormData): Promise<void> {
  const { student } = await requireStudent();
  const homeworkId = String(formData.get("homeworkId") ?? "");

  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
    include: { teacher: { select: { userId: true } } },
  });
  // Başkasının ödevine dokunulamaz
  if (!homework || homework.studentId !== student.id) redirect("/ogrenci/odevler?hata=bulunamadi");

  // Koşullu güncelleme: çift tıklamada ikinci kez bildirim gitmez
  const res = await prisma.homework.updateMany({
    where: { id: homework.id, studentId: student.id, completedAt: null },
    data: { completedAt: new Date() },
  });

  if (res.count > 0) {
    await notifyUser({
      userId: homework.teacher.userId,
      type: "HOMEWORK_DONE",
      title: `${student.name} ödevini tamamladı`,
      body: homework.title,
      dedupeKey: `homework-done:${homework.id}`,
      email: false,
      ctaPath: `/ogretmen/ogrencilerim/${student.id}`,
      ctaLabel: "Öğrenciye git",
    });
  }

  revalidatePath("/ogrenci/odevler");
  redirect("/ogrenci/odevler?ok=tamamlandi");
}

export async function cancelLessonAction(formData: FormData): Promise<void> {
  const { student } = await requireStudent();
  const lessonId = String(formData.get("lessonId") ?? "");

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  // Başkasının dersine dokunulamaz
  if (!lesson || lesson.studentId !== student.id) redirect("/ogrenci/derslerim?hata=bulunamadi");
  if (!ACTIVE_STATUSES.includes(lesson.status)) redirect("/ogrenci/derslerim?hata=iptal-edilemez");

  // Onaylı derslerde iptal penceresi uygulanır; onay bekleyen talep her zaman çekilebilir
  if (lesson.status === "CONFIRMED") {
    const windowHours = await getNumberSetting("cancelWindowHours", 12);
    const msLeft = lesson.scheduledAt.getTime() - Date.now();
    if (msLeft < windowHours * 3600_000) redirect("/ogrenci/derslerim?hata=iptal-suresi");
  }

  await prisma.$transaction(async (tx: Tx) => {
    await tx.lesson.update({
      where: { id: lesson.id },
      data: { status: "CANCELLED", slotKey: null }, // saat tekrar müsait olur
    });
    // Onayda düşen paket hakkını iade et (talep aşamasında hiç düşmemişti)
    if (lesson.status === "CONFIRMED" && lesson.purchaseId) {
      await tx.purchase.update({
        where: { id: lesson.purchaseId },
        data: { remainingLessons: { increment: 1 } },
      });
    }
    // Onayda tüketilen deneme hakkı da iade edilir
    if (lesson.status === "CONFIRMED" && lesson.isTrial) {
      await tx.studentProfile.update({
        where: { id: lesson.studentId },
        data: { hasUsedTrial: false },
      });
    }
  });

  revalidatePath("/ogrenci");
  revalidatePath("/ogrenci/derslerim");
  redirect("/ogrenci/derslerim?iptal=ok");
}
