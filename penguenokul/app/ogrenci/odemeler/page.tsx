import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { formatDateTime, formatTL } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Ödemeler" };
export const dynamic = "force-dynamic";

const statusText: Record<string, string> = { PENDING: "Bekliyor", PAID: "Ödendi", FAILED: "Başarısız", REFUNDED: "İade edildi" };

export default async function OgrenciOdemelerPage({ searchParams }: { searchParams: { odeme?: string } }) {
  const { student } = await requireStudent();

  const payments = await prisma.payment.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { package: { select: { name: true, lessonCount: true } }, invoice: { select: { invoiceNumber: true } } },
  });

  const justNow = searchParams.odeme ? payments.find((p) => p.id === searchParams.odeme) : undefined;

  return (
    <>
      <h1 className={styles.pageTitle}>Ödemeler</h1>
      <p className={styles.sub}>Ödeme geçmişin ve ödeme belgelerin.</p>

      {justNow?.status === "PAID" && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Ödemen alındı, paketin hesabına tanımlandı.</p>
      )}
      {justNow?.status === "FAILED" && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>Ödeme tamamlanamadı. İstersen Paketler sayfasından tekrar deneyebilirsin.</p>
      )}
      {justNow?.status === "PENDING" && (
        <p role="status" className={`${styles.alert} ${styles.warn}`}>Ödemen henüz onaylanmadı. Birkaç dakika içinde burada görünür; sayfayı yenileyebilirsin.</p>
      )}

      {payments.length === 0 ? (
        <div className={styles.empty}>Henüz ödemen yok.</div>
      ) : (
        <ul className={styles.list}>
          {payments.map((p) => (
            <li key={p.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{p.package.name} ({p.package.lessonCount} ders)</span>
                <span className={styles.rowMeta}>
                  {formatDateTime(p.paidAt ?? p.createdAt)}
                  {p.invoice ? ` · Belge no: ${p.invoice.invoiceNumber}` : ""}
                </span>
                {p.status === "FAILED" && p.failureReason && <span className={styles.rowMeta}>{p.failureReason}</span>}
              </div>
              <div className={styles.rowSide}>
                <span className={styles.tag}>{statusText[p.status] ?? p.status}</span>
                <strong>{formatTL(p.amount)}</strong>
                {p.invoice && (
                  <a href={`/api/fatura/${p.id}`} target="_blank" rel="noopener" className={styles.linkButton}>Belgeyi aç (PDF)</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
