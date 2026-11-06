"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { recordEarning } from "@/lib/earnings";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
import { SETTING_FIELDS, getNumberSetting } from "@/lib/settings";

// ───────────── Öğretmen durumu ─────────────

const TEACHER_INTENTS = {
  approve: { from: "PENDING", to: "ACTIVE", needsSubjects: true },
  reject: { from: "PENDING", to: "SUSPENDED", needsSubjects: false },
  suspend: { from: "ACTIVE", to: "SUSPENDED", needsSubjects: false },
  reactivate: { from: "SUSPENDED", to: "ACTIVE", needsSubjects: true },
} as const;

type TeacherIntent = keyof typeof TEACHER_INTENTS;
type Rule = (typeof TEACHER_INTENTS)[TeacherIntent];

const teacherMessages: Record<TeacherIntent, (reason: string | null) => { title: string; body: string; ctaPath?: string; ctaLabel?: string }> = {
  approve: () => ({
    title: "Başvurun onaylandı",
    body: "Artık öğrenciler seni listede görebilir ve ders talebi gönderebilir. Müsaitlik takvimini kontrol etmeyi unutma.",
    ctaPath: "/ogretmen/takvim",
    ctaLabel: "Takvime git",
  }),
  reject: (reason) => ({
    title: "Başvurun onaylanmadı",
    body: reason ? `Gerekçe: ${reason}` : "Başvurun şu an için onaylanmadı. Ayrıntı için destek ekibiyle iletişime geçebilirsin.",
  }),
  suspend: (reason) => ({
    title: "Hesabın askıya alındı",
    body: reason ? `Gerekçe: ${reason}` : "Hesabın geçici olarak askıya alındı. Ayrıntı için destek ekibiyle iletişime geçebilirsin.",
  }),
  reactivate: () => ({
    title: "Hesabın yeniden etkinleştirildi",
    body: "Hesabın yeniden aktif. Öğrenciler seni tekrar listede görebilir.",
    ctaPath: "/ogretmen",
    ctaLabel: "Panele git",
  }),
};

export async function setTeacherStatusAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();

  const teacherId = String(formData.get("teacherId") ?? "");
  const intentRaw = String(formData.get("intent") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;

  const rule = (TEACHER_INTENTS as Record<string, Rule | undefined>)[intentRaw];
  if (!rule) redirect("/admin/ogretmenler?hata=gecersiz");
  const intent = intentRaw as TeacherIntent;

  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { _count: { select: { subjects: true } } },
  });
  if (!teacher) redirect(`/admin/ogretmenler?durum=${rule.from}&hata=bulunamadi`);
  if (teacher.status !== rule.from) redirect(`/admin/ogretmenler?durum=${rule.from}&hata=durum-degismis`);
  if (rule.needsSubjects && teacher._count.subjects === 0) {
    redirect(`/admin/ogretmenler?durum=${rule.from}&hata=brans`);
  }

  type Released = { id: string; scheduledAt: Date; studentUserId: string };
  let released: Released[] = [];
  let conflict = false;

  try {
    released = await prisma.$transaction(async (tx: Tx) => {
      // Koşullu güncelleme: iki admin aynı anda işlem yaparsa ikincisi çakışma alır
      const res = await tx.teacherProfile.updateMany({
        where: { id: teacher.id, status: rule.from },
        data: { status: rule.to },
      });
      if (res.count === 0) throw new Error("conflict");

      await logAudit(tx, {
        adminId: admin.id,
        action: `teacher.${intent}`,
        targetType: "TeacherProfile",
        targetId: teacher.id,
        before: { status: rule.from },
        after: { status: rule.to, reason },
      });

      if (rule.to !== "SUSPENDED") return [];

      // Askıya alınan öğretmenin onay bekleyen talepleri reddedilir ve saatler serbest kalır.
      // Hak talep anında düşmediği için iade gerekmez. Onaylı dersler elle yönetilir (Dersler sayfası).
      const open = (await tx.lesson.findMany({
        where: { teacherId: teacher.id, status: "REQUESTED" },
        select: { id: true, scheduledAt: true, student: { select: { userId: true } } },
      })) as { id: string; scheduledAt: Date; student: { userId: string } }[];

      const ids = open.map((l) => l.id);
      if (ids.length > 0) {
        await tx.lesson.updateMany({
          where: { id: { in: ids }, status: "REQUESTED" },
          data: { status: "REJECTED", slotKey: null },
        });
        await tx.lessonRequest.updateMany({
          where: { lessonId: { in: ids } },
          data: { respondedAt: new Date(), reason: "Öğretmen şu an ders vermiyor" },
        });
      }
      return open.map((l) => ({ id: l.id, scheduledAt: l.scheduledAt, studentUserId: l.student.userId }));
    });
  } catch (err) {
    if ((err as Error).message === "conflict") conflict = true;
    else throw err;
  }
  if (conflict) redirect(`/admin/ogretmenler?durum=${rule.from}&hata=durum-degismis`);

  // Bildirimler transaction dışında: e-posta sorunu işlemi geri almasın
  await notifyUser({ userId: teacher.userId, type: `TEACHER_${intent.toUpperCase()}`, ...teacherMessages[intent](reason) });
  for (const l of released) {
    await notifyUser({
      userId: l.studentUserId,
      type: "LESSON_REJECTED",
      title: "Ders talebin iptal edildi",
      body: `${teacher.name}, ${formatDateTime(l.scheduledAt)} tarihli talebin için artık ders veremiyor. Başka bir öğretmen seçebilirsin.`,
      dedupeKey: `rejected:${l.id}`,
      ctaPath: "/ogrenci/ders-al",
      ctaLabel: "Yeni ders al",
    });
  }

  // Askıya alırken, yine de onaylı dersi kalan sayısını admin'e göster
  let open = 0;
  if (rule.to === "SUSPENDED") {
    open = (await prisma.lesson.count({
      where: { teacherId: teacher.id, status: "CONFIRMED", scheduledAt: { gte: new Date() } },
    })) as number;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ogretmenler");
  redirect(`/admin/ogretmenler?durum=${rule.to}&ok=${intent}${open > 0 ? `&acik=${open}` : ""}`);
}

// ───────────── Ders yönetimi ─────────────

export async function adminCancelLessonAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const lessonId = String(formData.get("lessonId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      student: { select: { userId: true, name: true } },
      teacher: { select: { userId: true, name: true } },
    },
  });
  if (!lesson) redirect("/admin/dersler?hata=bulunamadi");
  if (lesson.status !== "REQUESTED" && lesson.status !== "CONFIRMED") redirect("/admin/dersler?hata=iptal-edilemez");

  const wasConfirmed = lesson.status === "CONFIRMED";
  let done = false;

  done = await prisma.$transaction(async (tx: Tx) => {
    const res = await tx.lesson.updateMany({
      where: { id: lesson.id, status: lesson.status },
      data: { status: "CANCELLED", slotKey: null },
    });
    if (res.count === 0) return false;

    // Hak yalnızca onayda düştüğü için iade de yalnızca onaylı derste yapılır
    if (wasConfirmed && lesson.purchaseId) {
      await tx.purchase.update({
        where: { id: lesson.purchaseId },
        data: { remainingLessons: { increment: 1 } },
      });
    }
    if (wasConfirmed && lesson.isTrial) {
      await tx.studentProfile.update({ where: { id: lesson.studentId }, data: { hasUsedTrial: false } });
    }

    await logAudit(tx, {
      adminId: admin.id,
      action: "lesson.cancel",
      targetType: "Lesson",
      targetId: lesson.id,
      before: { status: lesson.status },
      after: { status: "CANCELLED", reason },
    });
    return true;
  });

  if (!done) redirect("/admin/dersler?hata=durum-degismis");

  const when = formatDateTime(lesson.scheduledAt);
  const suffix = reason ? ` Gerekçe: ${reason}` : "";
  await notifyUser({
    userId: lesson.student.userId,
    type: "LESSON_CANCELLED",
    title: "Dersin iptal edildi",
    body: `${lesson.teacher.name} ile ${when} tarihli dersin yönetici tarafından iptal edildi.${wasConfirmed ? " Ders hakkın iade edildi." : ""}${suffix}`,
    ctaPath: "/ogrenci/ders-al",
    ctaLabel: "Yeni ders al",
  });
  await notifyUser({
    userId: lesson.teacher.userId,
    type: "LESSON_CANCELLED",
    title: "Ders iptal edildi",
    body: `${lesson.student.name} ile ${when} tarihli ders yönetici tarafından iptal edildi.${suffix}`,
    ctaPath: "/ogretmen/takvim",
    ctaLabel: "Takvime git",
  });

  revalidatePath("/admin/dersler");
  redirect("/admin/dersler?ok=iptal");
}

// Bitmiş bir dersin sonucunu işaretler. Hak onayda düştüğü için sonuç ne olursa olsun bakiye değişmez.
export async function markLessonAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const lessonId = String(formData.get("lessonId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (outcome !== "COMPLETED" && outcome !== "NO_SHOW") redirect("/admin/dersler?hata=gecersiz");

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) redirect("/admin/dersler?hata=bulunamadi");

  const ended = lesson.scheduledAt.getTime() + lesson.durationMin * 60_000 <= Date.now();
  const markable = ["CONFIRMED", "COMPLETED", "NO_SHOW"].includes(lesson.status);
  if (!ended || !markable) redirect("/admin/dersler?hata=isaretlenemez");
  if (lesson.status === outcome) redirect("/admin/dersler");

  await prisma.$transaction(async (tx: Tx) => {
    await tx.lesson.update({ where: { id: lesson.id }, data: { status: outcome } });
    // Katılım olmasa da (öğrenci gelmedi) hak yandığı için öğretmen payı doğar
    await recordEarning(tx, lesson.id);
    await logAudit(tx, {
      adminId: admin.id,
      action: "lesson.mark",
      targetType: "Lesson",
      targetId: lesson.id,
      before: { status: lesson.status },
      after: { status: outcome },
    });
  });

  revalidatePath("/admin/dersler");
  redirect("/admin/dersler?ok=isaretlendi");
}

// ───────────── Ayarlar ─────────────

export type SettingsState = { error?: string; ok?: boolean } | undefined;

export async function updateSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user: admin } = await requireAdmin();

  const next: Record<string, number> = {};
  for (const f of SETTING_FIELDS) {
    const raw = String(formData.get(f.key) ?? "").trim();
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < f.min || n > f.max) {
      return { error: `${f.label}: ${f.min} ile ${f.max} arasında bir tam sayı olmalı.` };
    }
    next[f.key] = n;
  }

  const before: Record<string, number> = {};
  for (const f of SETTING_FIELDS) before[f.key] = await getNumberSetting(f.key, f.fallback);

  const changed = SETTING_FIELDS.filter((f) => before[f.key] !== next[f.key]);
  if (changed.length === 0) return { ok: true };

  await prisma.$transaction(async (tx: Tx) => {
    for (const f of changed) {
      const value = String(next[f.key]);
      await tx.setting.upsert({ where: { key: f.key }, update: { value }, create: { key: f.key, value } });
    }
    await logAudit(tx, {
      adminId: admin.id,
      action: "settings.update",
      targetType: "Setting",
      targetId: changed.map((f) => f.key).join(","),
      before: Object.fromEntries(changed.map((f) => [f.key, before[f.key]])),
      after: Object.fromEntries(changed.map((f) => [f.key, next[f.key]])),
    });
  });

  revalidatePath("/admin/ayarlar");
  return { ok: true };
}
