"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { notifyUser } from "@/lib/notify";

export type ReviewState = { ok?: boolean; error?: string } | undefined;

// Öğrenci yalnızca kendi TAMAMLANMIŞ dersini, bir kez değerlendirebilir.
export async function submitReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const { student } = await requireStudent();
  const lessonId = String(formData.get("lessonId") ?? "");
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Lütfen 1 ile 5 arasında bir puan seç." };
  if (comment.length > 500) return { error: "Yorum en fazla 500 karakter olabilir." };

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { teacher: { select: { userId: true } } },
  });
  if (!lesson || lesson.studentId !== student.id) return { error: "Ders bulunamadı." };
  if (lesson.status !== "COMPLETED") return { error: "Yalnızca tamamlanan dersler değerlendirilebilir." };

  try {
    await prisma.review.create({
      data: { lessonId: lesson.id, studentId: student.id, teacherId: lesson.teacherId, rating, comment: comment || null },
    });
  } catch (err) {
    // unique(lessonId): ikinci kez değerlendirme
    if ((err as { code?: string }).code === "P2002") return { error: "Bu dersi zaten değerlendirdin." };
    console.error("değerlendirme hatası", err);
    return { error: "Değerlendirme kaydedilemedi. Biraz sonra tekrar dene." };
  }

  await notifyUser({
    userId: lesson.teacher.userId,
    type: "REVIEW_RECEIVED",
    title: `${student.name} dersini değerlendirdi`,
    body: `${rating}/5${comment ? ` · “${comment.slice(0, 120)}”` : ""}`,
    dedupeKey: `review:${lesson.id}`,
    email: false,
  });

  revalidatePath("/ogrenci/derslerim");
  revalidatePath(`/ogrenci/ders-al/${lesson.teacherId}`);
  return { ok: true };
}

export async function getTeacherRating(teacherId: string): Promise<{ average: number; count: number }> {
  const agg = await prisma.review.aggregate({ where: { teacherId }, _avg: { rating: true }, _count: { _all: true } });
  return { average: agg._avg.rating ?? 0, count: agg._count._all };
}
