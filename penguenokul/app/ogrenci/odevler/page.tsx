import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { completeHomeworkAction } from "@/lib/student-actions";
import { formatDay } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Ödevlerim" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date;
  completedAt: Date | null;
  teacher: { name: string };
};

export default async function OdevlerPage({ searchParams }: { searchParams: { ok?: string; hata?: string } }) {
  const { student } = await requireStudent();
  const now = new Date();

  const [open, done] = await Promise.all([
    prisma.homework.findMany({
      where: { studentId: student.id, completedAt: null },
      orderBy: { dueAt: "asc" },
      include: { teacher: { select: { name: true } } },
    }) as Promise<Row[]>,
    prisma.homework.findMany({
      where: { studentId: student.id, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 20,
      include: { teacher: { select: { name: true } } },
    }) as Promise<Row[]>,
  ]);

  return (
    <>
      <h1 className={styles.pageTitle}>Ödevlerim</h1>
      <p className={styles.sub}>Öğretmenlerinin verdiği ödevler. Bitirince &ldquo;Tamamladım&rdquo; de, öğretmenin haberdar olsun.</p>

      {searchParams.ok === "tamamlandi" && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Ödev tamamlandı olarak işaretlendi.</p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>Ödev bulunamadı.</p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bekleyen</h2>
        {open.length === 0 ? (
          <div className={styles.empty}>
            Bekleyen ödevin yok. Bir öğretmenle ders yaptıkça ödevler burada görünür.{" "}
            <Link href="/ogrenci/ders-al">Ders al</Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {open.map((h) => {
              const overdue = h.dueAt < now;
              return (
                <li key={h.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{h.title}</span>
                    {h.description && <span className={styles.rowMeta}>{h.description}</span>}
                    <span className={styles.rowMeta}>
                      {h.teacher.name} · son tarih: {formatDay(h.dueAt)}
                    </span>
                  </div>
                  <div className={styles.rowSide}>
                    {overdue && <span className={`${styles.tag} ${styles.warn}`}>Süresi geçti</span>}
                    <form action={completeHomeworkAction}>
                      <input type="hidden" name="homeworkId" value={h.id} />
                      <button type="submit" className={styles.button}>Tamamladım</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tamamlanan</h2>
          <ul className={styles.list}>
            {done.map((h) => (
              <li key={h.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{h.title}</span>
                  <span className={styles.rowMeta}>{h.teacher.name}</span>
                </div>
                <span className={styles.tag}>{h.completedAt ? formatDay(h.completedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
