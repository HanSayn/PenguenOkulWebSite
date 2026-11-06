import type { Tx } from "@/lib/prisma";

// Tamamlanan (ya da öğrencinin gelmediği) bir paket dersi için komisyon dağılımını ayrı kayıt olarak yazar.
// - Deneme dersi ücretsizdir, kazanç doğmaz.
// - Brüt tutar, satın alma anında sabitlenen ders başı fiyattır (paket fiyatı sonradan değişse de etkilenmez).
// - Komisyon oranı o anki öğretmen oranıdır ve kayda yazılır; sonradan oran değişse de kayıt sabit kalır.
// - İdempotent: aynı ders için ikinci kez çağrılırsa mevcut kayıt döner.
export async function recordEarning(tx: Tx, lessonId: string) {
  const existing = await tx.lessonEarning.findUnique({ where: { lessonId } });
  if (existing) return existing;

  const lesson = await tx.lesson.findUnique({
    where: { id: lessonId },
    include: { purchase: { select: { id: true, unitPrice: true } }, teacher: { select: { id: true, commissionRate: true } } },
  });
  if (!lesson || lesson.isTrial || !lesson.purchase || lesson.purchase.unitPrice <= 0) return null;
  if (lesson.status !== "COMPLETED" && lesson.status !== "NO_SHOW") return null;

  const gross = lesson.purchase.unitPrice;
  const rate = lesson.teacher.commissionRate;
  const commission = Math.round(gross * rate);

  return tx.lessonEarning.create({
    data: {
      lessonId,
      teacherId: lesson.teacher.id,
      purchaseId: lesson.purchase.id,
      gross,
      commissionRate: rate,
      commission,
      net: gross - commission,
    },
  });
}
