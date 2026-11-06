"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { createMeetingRoom, MeetingUnavailableError } from "@/lib/meeting";
import { notifyUser } from "@/lib/notify";
import { addDays, formatDateTime, formatDay, istanbulDate, toMinutes, ymdIstanbul } from "@/lib/format";
import { hasLessonBetween, TEACHING_STATUSES } from "@/lib/relations";

// ───────────── Müsaitlik ─────────────

export type AvailabilityState = { error?: string; ok?: boolean } | undefined;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı");

const availabilitySchema = z
  .object({
    kind: z.enum(["recurring", "specific"]),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: time,
    endTime: time,
  })
  .refine((v) => toMinutes(v.startTime) < toMinutes(v.endTime), {
    message: "Bitiş saati başlangıçtan sonra olmalı",
    path: ["endTime"],
  })
  .refine((v) => (v.kind === "recurring" ? v.dayOfWeek !== undefined : !!v.date), {
    message: "Gün ya da tarih seçmelisin",
    path: ["kind"],
  });

export async function addAvailabilityAction(
  _prev: AvailabilityState,
  formData: FormData
): Promise<AvailabilityState> {
  const { teacher } = await requireTeacher();

  const parsed = availabilitySchema.safeParse({
    kind: formData.get("kind"),
    dayOfWeek: formData.get("dayOfWeek") || undefined,
    date: formData.get("date") || undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const v = parsed.data;
  const isRecurring = v.kind === "recurring";
  let specificDate: Date | null = null;

  if (!isRecurring) {
    specificDate = istanbulDate(v.date!, "00:00");
    if (v.date! < ymdIstanbul(new Date())) return { error: "Geçmiş bir tarih seçemezsin." };
  }

  // Aynı gün için çakışan aralık eklenmesin
  const sameDay = (await prisma.availability.findMany({
    where: isRecurring
      ? { teacherId: teacher.id, isRecurring: true, dayOfWeek: v.dayOfWeek }
      : { teacherId: teacher.id, isRecurring: false, specificDate },
  })) as { startTime: string; endTime: string }[];

  const overlaps = sameDay.some(
    (a) => toMinutes(v.startTime) < toMinutes(a.endTime) && toMinutes(v.endTime) > toMinutes(a.startTime)
  );
  if (overlaps) return { error: "Bu aralık mevcut bir müsaitlikle çakışıyor." };

  await prisma.availability.create({
    data: {
      teacherId: teacher.id,
      isRecurring,
      dayOfWeek: isRecurring ? v.dayOfWeek : null,
      specificDate,
      startTime: v.startTime,
      endTime: v.endTime,
    },
  });

  revalidatePath("/ogretmen/takvim");
  return { ok: true };
}

export async function deleteAvailabilityAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const id = String(formData.get("id") ?? "");

  // teacherId filtresi: başkasının kaydı silinemez. Daha önce onaylanmış dersler etkilenmez.
  await prisma.availability.deleteMany({ where: { id, teacherId: teacher.id } });
  revalidatePath("/ogretmen/takvim");
}

// ───────────── Profil ─────────────

export type ProfileState = { error?: string; ok?: boolean } | undefined;

export async function saveProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const { teacher } = await requireTeacher();

  const name = String(formData.get("name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const scoreRaw = String(formData.get("osymScore") ?? "").trim().replace(",", ".");
  const subjectIds = [...new Set(formData.getAll("subjectIds").map(String))];

  if (name.length < 2 || name.length > 80) return { error: "Ad soyad 2-80 karakter arasında olmalı." };
  if (bio.length > 600) return { error: "Tanıtım yazısı en fazla 600 karakter olabilir." };

  let osymScore: number | null = null;
  if (scoreRaw) {
    osymScore = Number(scoreRaw);
    if (!Number.isFinite(osymScore) || osymScore < 0 || osymScore > 600) {
      return { error: "ÖSYM puanı 0-600 arasında bir sayı olmalı." };
    }
  }

  // İstemciden gelen kimliklere güvenme: yalnızca gerçekten var olan branşlar kaydedilir
  const valid = (await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true },
  })) as { id: string }[];

  await prisma.$transaction(async (tx: Tx) => {
    await tx.teacherProfile.update({
      where: { id: teacher.id },
      data: { name, bio: bio || null, osymScore },
    });
    await tx.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
    if (valid.length > 0) {
      await tx.teacherSubject.createMany({
        data: valid.map((s) => ({ teacherId: teacher.id, subjectId: s.id })),
      });
    }
  });

  revalidatePath("/ogretmen");
  revalidatePath("/ogretmen/profil");
  return { ok: true };
}

// ───────────── Öğrenci takibi (not, ödev) ─────────────

const studentUrl = (studentId: string, query = "") =>
  `/ogretmen/ogrencilerim/${studentId}${query ? `?${query}` : ""}`;

// Not ve ödev yalnızca gerçekten ders ilişkisi kurulmuş öğrenciler için tutulur
async function requireTrackedStudent(teacherId: string, studentId: string) {
  if (!studentId || !(await hasLessonBetween(teacherId, studentId, TEACHING_STATUSES))) {
    redirect("/ogretmen/ogrencilerim?hata=bulunamadi");
  }
}

export async function addNoteAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  await requireTrackedStudent(teacher.id, studentId);
  if (!content) redirect(studentUrl(studentId, "hata=not-bos"));
  if (content.length > 1000) redirect(studentUrl(studentId, "hata=not-uzun"));

  await prisma.teacherNote.create({ data: { teacherId: teacher.id, studentId, content } });
  revalidatePath(studentUrl(studentId));
  redirect(studentUrl(studentId, "ok=not"));
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "");
  const noteId = String(formData.get("noteId") ?? "");

  // teacherId filtresi: başkasının notu silinemez
  await prisma.teacherNote.deleteMany({ where: { id: noteId, teacherId: teacher.id } });
  revalidatePath(studentUrl(studentId));
  redirect(studentUrl(studentId, "ok=not-silindi"));
}

export async function assignHomeworkAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const due = String(formData.get("due") ?? "");

  await requireTrackedStudent(teacher.id, studentId);
  if (title.length < 2 || title.length > 120) redirect(studentUrl(studentId, "hata=odev-baslik"));
  if (description.length > 1000) redirect(studentUrl(studentId, "hata=odev-uzun"));

  const today = ymdIstanbul(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today || due > addDays(today, 90)) {
    redirect(studentUrl(studentId, "hata=odev-tarih"));
  }

  const dueAt = istanbulDate(due, "23:59");
  const homework = (await prisma.homework.create({
    data: { teacherId: teacher.id, studentId, title, description: description || null, dueAt },
    select: { id: true },
  })) as { id: string };

  const student = (await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { userId: true },
  })) as { userId: string } | null;
  if (student) {
    await notifyUser({
      userId: student.userId,
      type: "HOMEWORK_ASSIGNED",
      title: "Yeni ödevin var",
      body: `${teacher.name}: ${title} (son tarih: ${formatDay(dueAt)})`,
      dedupeKey: `homework:${homework.id}`,
      ctaPath: "/ogrenci/odevler",
      ctaLabel: "Ödevlerime git",
    });
  }

  revalidatePath(studentUrl(studentId));
  redirect(studentUrl(studentId, "ok=odev"));
}

export async function deleteHomeworkAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "");
  const homeworkId = String(formData.get("homeworkId") ?? "");

  await prisma.homework.deleteMany({ where: { id: homeworkId, teacherId: teacher.id } });
  revalidatePath(studentUrl(studentId));
  redirect(studentUrl(studentId, "ok=odev-silindi"));
}

// ───────────── Talepler ─────────────

export async function approveLessonAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const lessonId = String(formData.get("lessonId") ?? "");
  const customLink = String(formData.get("meetingLink") ?? "").trim();

  if (customLink && !/^https:\/\/\S+$/.test(customLink)) redirect("/ogretmen/talepler?hata=link");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { request: true, student: { select: { userId: true } } },
  });
  if (!lesson || lesson.teacherId !== teacher.id) redirect("/ogretmen/talepler?hata=bulunamadi");
  if (lesson.status !== "REQUESTED") redirect("/ogretmen/talepler?hata=zaten-yanitlandi");

  const now = new Date();
  const expired =
    (lesson.request && lesson.request.expiresAt <= now) || lesson.scheduledAt <= now;
  if (expired) {
    // Süresi geçmiş talep onaylanamaz; saati serbest bırak
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "EXPIRED", slotKey: null } });
    redirect("/ogretmen/talepler?hata=suresi-doldu");
  }

  // Görüşme odası transaction dışında hazırlanır: dış sağlayıcı çağrısı veritabanı kilidini tutmasın
  let meetingLink = customLink;
  if (!meetingLink) {
    try {
      meetingLink = (await createMeetingRoom({ lessonId: lesson.id, startsAt: lesson.scheduledAt, durationMin: lesson.durationMin })).url;
    } catch (err) {
      if (err instanceof MeetingUnavailableError) redirect("/ogretmen/talepler?hata=gorusme");
      throw err;
    }
  }

  let failure: string | null = null;

  try {
    await prisma.$transaction(async (tx: Tx) => {
      if (lesson.isTrial) {
        // Deneme hakkı onayda tüketilir. Koşullu güncelleme: ikinci kez kullanılamaz.
        const res = await tx.studentProfile.updateMany({
          where: { id: lesson.studentId, hasUsedTrial: false },
          data: { hasUsedTrial: true },
        });
        if (res.count === 0) throw new Error("trial-used");
      } else if (lesson.purchaseId) {
        // Paket hakkı onayda düşer. Koşullu güncelleme: bakiye eksiye düşemez.
        const res = await tx.purchase.updateMany({
          where: { id: lesson.purchaseId, remainingLessons: { gt: 0 }, expiresAt: { gt: now } },
          data: { remainingLessons: { decrement: 1 } },
        });
        if (res.count === 0) throw new Error("no-credit");
      }

      await tx.lesson.update({
        where: { id: lesson.id },
        data: { status: "CONFIRMED", meetingLink },
      });
      await tx.lessonRequest.updateMany({
        where: { lessonId: lesson.id },
        data: { respondedAt: now },
      });
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "trial-used" || msg === "no-credit") failure = msg;
    else throw err;
  }

  if (failure) redirect(`/ogretmen/talepler?hata=${failure}`);

  // Bildirim transaction dışında: e-posta gönderimi onayı geri almasın / geciktirmesin
  await notifyUser({
    userId: lesson.student.userId,
    type: "LESSON_CONFIRMED",
    title: "Dersin onaylandı",
    body: `${teacher.name}, ${formatDateTime(lesson.scheduledAt)} tarihli ders talebini onayladı. Görüşme bağlantısı ders başlamadan önce Derslerim sayfasında açılır.`,
    dedupeKey: `confirmed:${lesson.id}`,
    ctaPath: "/ogrenci/derslerim",
    ctaLabel: "Derslerime git",
  });

  revalidatePath("/ogretmen");
  revalidatePath("/ogretmen/talepler");
  redirect("/ogretmen/talepler?onay=ok");
}

export async function rejectLessonAction(formData: FormData): Promise<void> {
  const { teacher } = await requireTeacher();
  const lessonId = String(formData.get("lessonId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { student: { select: { userId: true } } },
  });
  if (!lesson || lesson.teacherId !== teacher.id) redirect("/ogretmen/talepler?hata=bulunamadi");
  if (lesson.status !== "REQUESTED") redirect("/ogretmen/talepler?hata=zaten-yanitlandi");

  await prisma.$transaction(async (tx: Tx) => {
    await tx.lesson.update({
      where: { id: lesson.id },
      data: { status: "REJECTED", slotKey: null }, // saat tekrar müsait olur
    });
    await tx.lessonRequest.updateMany({
      where: { lessonId: lesson.id },
      data: { respondedAt: new Date(), reason },
    });
  });

  await notifyUser({
    userId: lesson.student.userId,
    type: "LESSON_REJECTED",
    title: "Ders talebin reddedildi",
    body: reason
      ? `${teacher.name}: ${reason}`
      : `${teacher.name}, ${formatDateTime(lesson.scheduledAt)} saatini uygun bulmadı. Başka bir saat deneyebilirsin.`,
    dedupeKey: `rejected:${lesson.id}`,
    ctaPath: "/ogrenci/ders-al",
    ctaLabel: "Yeni ders al",
  });

  revalidatePath("/ogretmen");
  revalidatePath("/ogretmen/talepler");
  redirect("/ogretmen/talepler?ret=ok");
}
