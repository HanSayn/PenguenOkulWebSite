import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { isMockEnabled } from "@/lib/payments";
import { mockCompleteAction } from "@/lib/payment-actions";
import { formatTL } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Test ödeme sayfası", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Gerçek sağlayıcının barındırdığı ödeme sayfasının yerine geçen TEST sayfası.
// Gerçek para hareketi yoktur; canlıda (ALLOW_MOCK_PAYMENTS olmadan) hiç açılmaz.
export default async function MockCheckoutPage({ params }: { params: { ref: string } }) {
  if (!isMockEnabled()) notFound();
  const { student } = await requireStudent();

  const payment = await prisma.payment.findUnique({
    where: { providerRef: params.ref },
    include: { package: { select: { name: true, lessonCount: true } } },
  });
  if (!payment || payment.studentId !== student.id || payment.provider !== "mock") notFound();

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-6) 16px" }}>
      <p role="note" className={`${styles.alert} ${styles.warn}`}>
        Bu bir <strong>test ödeme sayfasıdır</strong>. Gerçek kart girilmez, para çekilmez.
      </p>
      <section className={styles.panel}>
        <h1 className={styles.pageTitle}>Ödeme</h1>
        <p>{payment.package.name} ({payment.package.lessonCount} ders)</p>
        <p className={styles.price}>{formatTL(payment.amount)}</p>

        {payment.status !== "PENDING" ? (
          <p className={styles.rowMeta}>Bu ödeme zaten sonuçlanmış. <a href="/ogrenci/odemeler">Ödemelerime dön</a></p>
        ) : (
          <form action={mockCompleteAction} className={styles.actionsStack}>
            <input type="hidden" name="ref" value={params.ref} />
            <button type="submit" name="outcome" value="success" className={styles.button}>Ödemeyi onayla</button>
            <button type="submit" name="outcome" value="fail" className={styles.buttonSecondary}>Ödemeyi başarısız say</button>
          </form>
        )}
      </section>
    </main>
  );
}
