import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { formatDateTime, formatTL } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Kazanç" };
export const dynamic = "force-dynamic";

export default async function OgretmenKazancPage() {
  const { teacher } = await requireTeacher();

  const [earnings, payouts] = await Promise.all([
    prisma.lessonEarning.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { lesson: { select: { scheduledAt: true, student: { select: { name: true } } } } },
    }),
    prisma.payout.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const sum = (rows: { net: number }[]) => rows.reduce((a, r) => a + r.net, 0);
  const total = sum(earnings);
  const waiting = sum(earnings.filter((e) => !e.payoutId));
  const paid = total - waiting;

  return (
    <>
      <h1 className={styles.pageTitle}>Kazanç</h1>
      <p className={styles.sub}>
        Her ders için öğrencinin ödediği tutar, platform komisyonu ve sana kalan pay ayrı ayrı gösterilir. Güncel komisyon oranın: <strong>%{Math.round(teacher.commissionRate * 1000) / 10}</strong>.
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(total)}</p><p className={styles.statLabel}>Toplam kazanç</p></div>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(waiting)}</p><p className={styles.statLabel}>Ödeme bekleyen</p></div>
        <div className={styles.stat}><p className={styles.statValue}>{formatTL(paid)}</p><p className={styles.statLabel}>Ödenen</p></div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ders bazında döküm</h2>
        {earnings.length === 0 ? (
          <div className={styles.empty}>Henüz kazanç doğan ders yok. Paketli bir ders tamamlandığında burada görünür. Deneme dersleri ücretsizdir.</div>
        ) : (
          <ul className={styles.list}>
            {earnings.map((e) => (
              <li key={e.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{e.lesson.student.name}</span>
                  <span className={styles.rowMeta}>
                    {formatDateTime(e.lesson.scheduledAt)} · Brüt {formatTL(e.gross)} − komisyon %{Math.round(e.commissionRate * 1000) / 10} ({formatTL(e.commission)})
                  </span>
                </div>
                <div className={styles.rowSide}>
                  <span className={styles.tag}>{e.payoutId ? "Ödendi" : "Bekliyor"}</span>
                  <strong>{formatTL(e.net)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ödemeler</h2>
        {payouts.length === 0 ? (
          <div className={styles.empty}>Henüz yapılmış bir ödeme yok.</div>
        ) : (
          <ul className={styles.list}>
            {payouts.map((p) => (
              <li key={p.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{formatDateTime(p.createdAt)}</span>
                  {p.note && <span className={styles.rowMeta}>{p.note}</span>}
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
