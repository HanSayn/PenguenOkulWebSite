import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ödeme sahibi öğrenci ya da yönetici indirebilir. Başkasının belgesi "bulunamadı" döner.
export async function GET(_req: Request, { params }: { params: { paymentId: string } }) {
  const session = await auth();
  if (!session?.user) return new Response("Giriş gerekli", { status: 401 });

  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { invoice: true, student: { select: { userId: true, user: { select: { email: true } } } } },
  });
  const isOwner = payment?.student.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!payment || !payment.invoice || (!isOwner && !isAdmin)) return new Response("Belge bulunamadı", { status: 404 });
  if (payment.status !== "PAID" && payment.status !== "REFUNDED") return new Response("Belge bulunamadı", { status: 404 });

  const pdf = await renderInvoicePdf({
    invoiceNumber: payment.invoice.invoiceNumber,
    issuedAt: payment.invoice.issuedAt,
    buyerName: payment.invoice.buyerName,
    buyerEmail: payment.student.user.email,
    description: payment.invoice.description,
    amount: payment.amount,
    status: payment.status,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="belge-${payment.invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
