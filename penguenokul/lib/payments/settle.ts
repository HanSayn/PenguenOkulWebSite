import { prisma, type Tx } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

import { TIMEOUT_REASON } from "@/lib/payments/constants";
import type { WebhookResult } from "@/lib/payments/types";

type Outcome = "SUCCEEDED" | "FAILED";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Yıllık, atomik fatura numarası: PO-2026-000001
async function nextInvoiceNumber(tx: Tx, now: Date): Promise<string> {
  const year = now.getFullYear();
  const counter = await tx.counter.upsert({
    where: { key: `invoice-${year}` },
    create: { key: `invoice-${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `PO-${year}-${String(counter.value).padStart(6, "0")}`;
}

// Ödeme sonucunu işler. Webhook, sahte ödeme sayfası ve zaman aşımı aynı yolu kullanır.
// İdempotenttir: PENDING → PAID/FAILED geçişi koşullu güncellemeyle yapılır, ikinci çağrı hiçbir şey değiştirmez.
export async function settlePayment(
  providerRef: string,
  outcome: Outcome,
  failureReason?: string,
  extra?: { providerPaymentId?: string }
): Promise<{ found: boolean; changed: boolean; status?: string; paymentId?: string; mismatch?: boolean }> {
  const result = await prisma.$transaction(async (tx: Tx) => {
    const payment = await tx.payment.findUnique({
      where: { providerRef },
      include: { package: true, student: { include: { user: { select: { id: true } } } } },
    });
    if (!payment) return { found: false as const };
    // Zaman aşımına düşmüş ödeme için sağlayıcıdan geç gelen BAŞARILI sonuç kaybolmasın (para alınmış olabilir)
    const lateSuccess =
      outcome === "SUCCEEDED" && payment.status === "FAILED" && (payment.failureReason ?? "").startsWith(TIMEOUT_REASON);
    if (payment.status !== "PENDING" && !lateSuccess) {
      return { found: true as const, changed: false, status: payment.status, paymentId: payment.id };
    }

    const now = new Date();
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: payment.status, ...(lateSuccess ? { failureReason: payment.failureReason } : {}) },
      data:
        outcome === "SUCCEEDED"
          ? { status: "PAID", paidAt: now, failureReason: null, ...(extra?.providerPaymentId ? { providerPaymentId: extra.providerPaymentId } : {}) }
          : { status: "FAILED", failureReason: failureReason ?? "Ödeme tamamlanamadı" },
    });
    if (claimed.count === 0) return { found: true as const, changed: false, status: "PAID", paymentId: payment.id };

    if (outcome === "SUCCEEDED") {
      const purchase = await tx.purchase.create({
        data: {
          studentId: payment.studentId,
          packageId: payment.packageId,
          remainingLessons: payment.package.lessonCount,
          expiresAt: addMonths(now, payment.package.durationMonths),
          unitPrice: Math.floor(payment.amount / payment.package.lessonCount),
        },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { purchaseId: purchase.id } });
      await tx.invoice.create({
        data: {
          paymentId: payment.id,
          invoiceNumber: await nextInvoiceNumber(tx, now),
          buyerName: payment.student.name,
          description: `${payment.package.name} (${payment.package.lessonCount} ders)`,
        },
      });
    }

    return {
      found: true as const,
      changed: true,
      status: outcome === "SUCCEEDED" ? "PAID" : "FAILED",
      paymentId: payment.id,
      userId: payment.student.user.id,
      packageName: payment.package.name,
    };
  });

  if (result.found && result.changed && "userId" in result && result.userId) {
    await notifyUser({
      userId: result.userId,
      type: result.status === "PAID" ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED",
      title: result.status === "PAID" ? "Ödemen alındı" : "Ödeme tamamlanamadı",
      body:
        result.status === "PAID"
          ? `${result.packageName} hesabına tanımlandı. Ders almaya başlayabilirsin.`
          : `${result.packageName} için ödeme tamamlanamadı. İstersen tekrar deneyebilirsin.`,
      dedupeKey: `payment:${result.paymentId}:${result.status}`,
      ctaPath: "/ogrenci/odemeler",
      ctaLabel: "Ödemelerime git",
    });
  }

  return result.found
    ? { found: true, changed: result.changed, status: result.status, paymentId: result.paymentId }
    : { found: false, changed: false };
}

// Sağlayıcıdan gelen (doğrulanmış) olayı işler: tutar kontrolü + idempotent kesinleştirme.
// Webhook/geri dönüş rotası ve mutabakat işi aynı yolu kullanır.
export async function settleProviderEvent(event: WebhookResult) {
  if (event.outcome === "PENDING") {
    const p = await prisma.payment.findUnique({ where: { providerRef: event.providerRef }, select: { id: true, status: true } });
    return p ? { found: true, changed: false, status: p.status, paymentId: p.id } : { found: false, changed: false };
  }

  if (event.outcome === "SUCCEEDED" && event.amount !== undefined) {
    const p = await prisma.payment.findUnique({ where: { providerRef: event.providerRef }, select: { id: true, status: true, amount: true } });
    if (p && p.status !== "PAID" && p.amount !== event.amount) {
      // Para alınmış olabilir ama tutar bizim kaydımızla uyuşmuyor: otomatik paket tanımlama, elle incelensin
      console.error(`[odeme] tutar uyuşmazlığı: ödeme ${p.id}, kayıt ${p.amount} kuruş, sağlayıcı ${event.amount} kuruş`);
      return { found: true, changed: false, status: p.status, paymentId: p.id, mismatch: true };
    }
  }
  return settlePayment(event.providerRef, event.outcome, event.failureReason, { providerPaymentId: event.providerPaymentId });
}
