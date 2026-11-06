import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { startCheckoutAction } from "@/lib/payment-actions";
import { formatDay, formatTL } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Paketler" };
export const dynamic = "force-dynamic";

const errMessages: Record<string, string> = {
  paket: "Bu paket artık satışta değil.",
  saglayici: "Ödeme sayfası şu an açılamadı. Biraz sonra tekrar dene.",
  "cok-deneme": "Çok sayıda bekleyen ödemen var. Önce onları tamamla ya da biraz bekle.",
};

export default async function OgrenciPaketlerPage({ searchParams }: { searchParams: { hata?: string } }) {
  const { student } = await requireStudent();
  const now = new Date();

  const [packages, purchases] = await Promise.all([
    prisma.package.findMany({ where: { isActive: true }, orderBy: { price: "asc" } }),
    prisma.purchase.findMany({
      where: { studentId: student.id },
      orderBy: { purchasedAt: "desc" },
      take: 10,
      include: { package: { select: { name: true } } },
    }),
  ]);

  const active = purchases.filter((p) => p.expiresAt > now && p.remainingLessons > 0);

  return (
    <>
      <h1 className={styles.pageTitle}>Paketler</h1>
      <p className={styles.sub}>Paket al, öğretmenini seç, saatini belirle. Her ders için ayrıca ödeme yapmazsın.</p>

      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{errMessages[searchParams.hata] ?? "Bir sorun oluştu."}</p>
      )}

      {active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Aktif paketlerin</h2>
          <ul className={styles.list}>
            {active.map((p) => (
              <li key={p.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{p.package.name}</span>
                  <span className={styles.rowMeta}>{formatDay(p.expiresAt)} tarihine kadar geçerli</span>
                </div>
                <span className={styles.tag}>{p.remainingLessons} ders hakkı</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Satın alınabilir paketler</h2>
        {packages.length === 0 ? (
          <div className={styles.empty}>Şu an satışta paket yok.</div>
        ) : (
          <div className={styles.cards}>
            {packages.map((p) => (
              <article key={p.id} className={styles.card}>
                <h3 className={styles.cardName}>{p.name}</h3>
                <p className={styles.price}>{formatTL(p.price)}</p>
                <p className={styles.cardBio}>
                  {p.lessonCount} ders · {p.durationMonths} ay geçerli<br />
                  Ders başına {formatTL(Math.floor(p.price / p.lessonCount))}
                </p>
                <form action={startCheckoutAction}>
                  <input type="hidden" name="packageId" value={p.id} />
                  <button type="submit" className={styles.button}>Satın al</button>
                </form>
              </article>
            ))}
          </div>
        )}
        <p className={styles.rowMeta} style={{ marginTop: "var(--space-3)" }}>
          Ödeme, güvenli ödeme sayfasında yapılır; kart bilgilerin Penguen Okul sunucularından geçmez.
        </p>
      </section>
    </>
  );
}
