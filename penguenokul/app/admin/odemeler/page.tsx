import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { refundPaymentAction } from "@/lib/payment-actions";
import { createPayoutAction } from "@/lib/payout-actions";
import { formatDateTime, formatTL } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Ödemeler" };
export const dynamic = "force-dynamic";

const statusText: Record<string, string> = { PENDING: "Bekliyor", PAID: "Ödendi", FAILED: "Başarısız", REFUNDED: "İade edildi" };

const okMessages: Record<string, string> = { iade: "Ödeme iade edildi.", odeme: "Öğretmen ödemesi kaydedildi." };
const errMessages: Record<string, string> = {
  bulunamadi: "Kayıt bulunamadı.",
  "iade-edilemez": "Bu ödeme iade edilemez.",
  "ders-kullanilmis": "Pakette kullanılmış ders var; otomatik iade yapılamaz.",
  saglayici: "Ödeme sağlayıcısı iadeyi gerçekleştiremedi. Kayıt değiştirilmedi.",
  "odenecek-yok": "Bu öğretmenin ödenecek bakiyesi yok.",
};

export default async function AdminOdemelerPage({ searchParams }: { searchParams: { ok?: string; hata?: string } }) {
  await requireAdmin();

  const [payments, earningAgg, unpaidByTeacher, payouts, paidAgg, refundedAgg] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { student: { select: { name: true } }, package: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } },
    }),
    prisma.lessonEarning.aggregate({ _sum: { gross: true, commission: true, net: true } }),
    prisma.lessonEarning.groupBy({ by: ["teacherId"], where: { payoutId: null }, _sum: { net: true }, _count: { _all: true } }),
    prisma.payout.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { teacher: { select: { name: true } } } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "REFUNDED" }, _sum: { amount: true } }),
  ]);

  const teacherNames = unpaidByTeacher.length
    ? await prisma.teacherProfile.findMany({ where: { id: { in: unpaidByTeacher.map((u) => u.teacherId) } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string) => teacherNames.find((t) => t.id === id)?.name ?? "Öğretmen";

  const collected = paidAgg._sum.amount ?? 0;
  const unpaidTotal = unpaidByTeacher.reduce((a, u) => a + (u._sum.net ?? 0), 0);

  return (
    <>
      <h1 className={styles.pageTitle}>Ödemeler</h1>
      <p className={styles.sub}>Tahsilatlar, platform komisyonu ve öğretmen hak edişleri.</p>

      {searchParams.ok && okMessages[searchParams.ok] && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>{okMessages[searchParams.ok]}</p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{errMessages[searchParams.hata] ?? "Bir sorun oluştu."}</p>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(collected)}</p><p className={styles.statLabel}>Net tahsilat</p></div>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(earningAgg._sum.commission ?? 0)}</p><p className={styles.statLabel}>Platform komisyonu (gerçekleşen)</p></div>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(earningAgg._sum.net ?? 0)}</p><p className={styles.statLabel}>Öğretmen payı (toplam)</p></div>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(unpaidTotal)}</p><p className={styles.statLabel}>Ödenmeyi bekleyen</p></div>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(refundedAgg._sum.amount ?? 0)}</p><p className={styles.statLabel}>İade edilen</p></div>
      </div>
      <p className={styles.rowMeta}>
        Net tahsilat, ders verildikçe komisyon ve öğretmen payına dönüşür; henüz verilmemiş derslerin tutarı platformda bekleyen bakiyedir.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Öğretmen hak edişleri</h2>
        {unpaidByTeacher.length === 0 ? (
          <div className={styles.empty}>Ödenmeyi bekleyen bakiye yok.</div>
        ) : (
          <ul className={styles.list}>
            {unpaidByTeacher.map((u) => (
              <li key={u.teacherId} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{nameOf(u.teacherId)}</span>
                  <span className={styles.rowMeta}>{u._count._all} ders</span>
                </div>
                <form action={createPayoutAction} className={styles.inlineForm}>
                  <input type="hidden" name="teacherId" value={u.teacherId} />
                  <input name="note" maxLength={200} placeholder="Not (ör. havale referansı)" aria-label="Not" className={`${styles.input} ${styles.textInput}`} />
                  <strong>{formatTL(u._sum.net ?? 0)}</strong>
                  <button type="submit" className={styles.button}>Ödendi olarak kaydet</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.rowMeta}>Para transferi platform dışında (havale/EFT) yapılır; buraya yalnızca kaydı işlenir.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tahsilatlar</h2>
        {payments.length === 0 ? (
          <div className={styles.empty}>Henüz ödeme yok.</div>
        ) : (
          <ul className={styles.list}>
            {payments.map((p) => (
              <li key={p.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{p.student.name} · {p.package.name}</span>
                  <span className={styles.rowMeta}>
                    {formatDateTime(p.paidAt ?? p.createdAt)} · {p.provider}
                    {p.invoice ? ` · ${p.invoice.invoiceNumber}` : ""}
                  </span>
                </div>
                <div className={styles.rowSide}>
                  <span className={styles.tag}>{statusText[p.status] ?? p.status}</span>
                  <strong>{formatTL(p.amount)}</strong>
                  {p.invoice && <a href={`/api/fatura/${p.id}`} target="_blank" rel="noopener" className={styles.linkButton}>PDF</a>}
                  {p.status === "PAID" && (
                    <form action={refundPaymentAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button type="submit" className={styles.linkButton}>İade et</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Yapılan öğretmen ödemeleri</h2>
        {payouts.length === 0 ? (
          <div className={styles.empty}>Henüz kayıt yok.</div>
        ) : (
          <ul className={styles.list}>
            {payouts.map((p) => (
              <li key={p.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{p.teacher.name}</span>
                  <span className={styles.rowMeta}>{formatDateTime(p.createdAt)}{p.note ? ` · ${p.note}` : ""}</span>
                </div>
                <strong>{formatTL(p.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
