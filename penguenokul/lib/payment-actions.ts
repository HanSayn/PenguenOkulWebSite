"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireStudent, requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { getPaymentProvider, isMockEnabled, ProviderUnavailableError } from "@/lib/payments";
import { settlePayment } from "@/lib/payments/settle";

const MAX_PENDING_PER_HOUR = 3;

// Öğrenci paket satın alır: ödeme kaydı açılır, sağlayıcının ödeme sayfasına yönlendirilir.
// Paket hakkı yalnızca ödeme doğrulanınca (webhook / sahte sayfa onayı) tanımlanır.
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const { user, student } = await requireStudent();
  const packageId = String(formData.get("packageId") ?? "");

  const pkg = await prisma.package.findFirst({ where: { id: packageId, isActive: true } });
  if (!pkg) redirect("/ogrenci/paketler?hata=paket");

  const recentPending = await prisma.payment.count({
    where: { studentId: student.id, status: "PENDING", createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recentPending >= MAX_PENDING_PER_HOUR) redirect("/ogrenci/paketler?hata=cok-deneme");

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (err) {
    if (err instanceof ProviderUnavailableError) redirect("/ogrenci/paketler?hata=saglayici");
    throw err;
  }

  const payment = await prisma.payment.create({
    data: { studentId: student.id, packageId: pkg.id, amount: pkg.price, provider: provider.name },
  });

  let redirectUrl: string;
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      amount: pkg.price,
      currency: "TRY",
      description: `${pkg.name} (${pkg.lessonCount} ders)`,
      buyer: { id: user.id, email: user.email ?? "", name: student.name },
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef } });
    redirectUrl = session.redirectUrl;
  } catch (err) {
    console.error("ödeme başlatılamadı", err);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Ödeme sayfası açılamadı" } });
    redirect("/ogrenci/paketler?hata=saglayici");
  }

  redirect(redirectUrl);
}

// Yalnızca sahte sağlayıcının sitedeki ödeme sayfası kullanır; gerçek sağlayıcılarda sonuç webhook ile gelir.
export async function mockCompleteAction(formData: FormData): Promise<void> {
  const { student } = await requireStudent();
  if (!isMockEnabled()) redirect("/ogrenci/paketler");

  const ref = String(formData.get("ref") ?? "");
  const outcome = String(formData.get("outcome") ?? "") === "success" ? "SUCCEEDED" : "FAILED";

  const payment = await prisma.payment.findUnique({ where: { providerRef: ref } });
  if (!payment || payment.studentId !== student.id || payment.provider !== "mock") redirect("/ogrenci/paketler");

  await settlePayment(ref, outcome, outcome === "FAILED" ? "Ödeme kullanıcı tarafından reddedildi (sahte sağlayıcı)" : undefined);
  revalidatePath("/ogrenci/odemeler");
  revalidatePath("/ogrenci/paketler");
  redirect(`/ogrenci/odemeler?odeme=${payment.id}`);
}

// Admin iadesi: yalnızca hiç ders kullanılmamış satın almalarda. Sağlayıcı iadesi başarısızsa kayıt değişmez.
export async function refundPaymentAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { userId: true } }, package: { select: { name: true } } },
  });
  if (!payment) redirect("/admin/odemeler?hata=bulunamadi");
  if (payment.status !== "PAID" || !payment.purchaseId || !payment.providerRef) redirect("/admin/odemeler?hata=iade-edilemez");

  const used = await prisma.lesson.count({
    where: { purchaseId: payment.purchaseId, status: { in: ["REQUESTED", "CONFIRMED", "COMPLETED", "NO_SHOW"] } },
  });
  if (used > 0) redirect("/admin/odemeler?hata=ders-kullanilmis");

  let refundRef: string;
  try {
    ({ refundRef } = await getPaymentProvider(payment.provider).refund({ providerRef: payment.providerRef, amount: payment.amount }));
  } catch (err) {
    console.error("iade başarısız", err);
    redirect("/admin/odemeler?hata=saglayici");
  }

  const purchaseId = payment.purchaseId;
  const done = await prisma.$transaction(async (tx: Tx) => {
    const res = await tx.payment.updateMany({ where: { id: payment.id, status: "PAID" }, data: { status: "REFUNDED" } });
    if (res.count === 0) return false;
    // Satın alma kullanılamaz hale gelir
    await tx.purchase.update({ where: { id: purchaseId }, data: { remainingLessons: 0, expiresAt: new Date() } });
    await logAudit(tx, {
      adminId: admin.id,
      action: "payment.refund",
      targetType: "Payment",
      targetId: payment.id,
      before: { status: "PAID" },
      after: { status: "REFUNDED", refundRef, amount: payment.amount },
    });
    return true;
  });
  if (!done) redirect("/admin/odemeler?hata=iade-edilemez");

  await notifyUser({
    userId: payment.student.userId,
    type: "PAYMENT_REFUNDED",
    title: "Ödemen iade edildi",
    body: `${payment.package.name} ödemen iade edildi.`,
    dedupeKey: `payment:${payment.id}:REFUNDED`,
    ctaPath: "/ogrenci/odemeler",
    ctaLabel: "Ödemelerime git",
  });

  revalidatePath("/admin/odemeler");
  redirect("/admin/odemeler?ok=iade");
}
