"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

// Bir öğretmenin henüz ödenmemiş tüm payını tek seferde "ödendi" olarak kaydeder.
// Para transferinin kendisi platform dışında (havale/EFT) yapılır; burası kaydı tutar.
export async function createPayoutAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  const teacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId }, select: { id: true, userId: true, name: true } });
  if (!teacher) redirect("/admin/odemeler?hata=bulunamadi");

  const payout = await prisma.$transaction(async (tx: Tx) => {
    const unpaid = await tx.lessonEarning.findMany({ where: { teacherId, payoutId: null }, select: { id: true, net: true } });
    if (unpaid.length === 0) return null;

    const amount = unpaid.reduce((sum, e) => sum + e.net, 0);
    const created = await tx.payout.create({ data: { teacherId, adminId: admin.id, amount, note } });
    // Koşullu bağlama: başka bir ödeme aynı kayıtları aldıysa tüm işlem geri alınır
    const linked = await tx.lessonEarning.updateMany({
      where: { id: { in: unpaid.map((e) => e.id) }, payoutId: null },
      data: { payoutId: created.id },
    });
    if (linked.count !== unpaid.length) throw new Error("Kazanç kayıtları aynı anda başka bir ödemeye bağlandı");

    await logAudit(tx, {
      adminId: admin.id,
      action: "payout.create",
      targetType: "Payout",
      targetId: created.id,
      after: { teacherId, amount, earnings: unpaid.length },
    });
    return created;
  });

  if (!payout) redirect("/admin/odemeler?hata=odenecek-yok");

  await notifyUser({
    userId: teacher.userId,
    type: "PAYOUT_SENT",
    title: "Kazancın ödendi",
    body: "Hak edişin ödendi. Ayrıntıları Kazanç sayfasında görebilirsin.",
    dedupeKey: `payout:${payout.id}`,
    ctaPath: "/ogretmen/kazanc",
    ctaLabel: "Kazanca git",
  });

  revalidatePath("/admin/odemeler");
  redirect("/admin/odemeler?ok=odeme");
}

// Öğretmenin komisyon oranı (%). Yalnızca bundan sonra tamamlanacak dersleri etkiler; geçmiş kayıtlar sabittir.
export async function setCommissionAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  const percent = Number(String(formData.get("percent") ?? "").replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) redirect("/admin/ogretmenler?hata=komisyon");

  const teacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId }, select: { commissionRate: true } });
  if (!teacher) redirect("/admin/ogretmenler?hata=bulunamadi");

  const rate = Math.round(percent * 100) / 10000; // 12,5 → 0.125
  await prisma.$transaction(async (tx: Tx) => {
    await tx.teacherProfile.update({ where: { id: teacherId }, data: { commissionRate: rate } });
    await logAudit(tx, {
      adminId: admin.id,
      action: "teacher.commission",
      targetType: "TeacherProfile",
      targetId: teacherId,
      before: { commissionRate: teacher.commissionRate },
      after: { commissionRate: rate },
    });
  });

  revalidatePath("/admin/ogretmenler");
  redirect("/admin/ogretmenler?ok=komisyon");
}
