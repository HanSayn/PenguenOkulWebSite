import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { insensitive } from "@/lib/db-compat";
import { requireAdmin } from "@/lib/session";
import { formatDay } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Öğrenciler" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  grade: string | null;
  targetExam: string | null;
  hasUsedTrial: boolean;
  parentName: string | null;
  parentPhone: string | null;
  user: { email: string; createdAt: Date };
  purchases: { remainingLessons: number; expiresAt: Date }[];
  _count: { lessons: number };
};

export default async function AdminOgrencilerPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireAdmin();
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const now = new Date();

  const students = (await prisma.studentProfile.findMany({
    where: q
      ? { OR: [{ name: { contains: q, ...insensitive } }, { user: { email: { contains: q, ...insensitive } } }] }
      : {},
    orderBy: { user: { createdAt: "desc" } },
    take: 100,
    include: {
      user: { select: { email: true, createdAt: true } },
      purchases: { select: { remainingLessons: true, expiresAt: true } },
      _count: { select: { lessons: true } },
    },
  })) as Row[];

  return (
    <>
      <h1 className={styles.pageTitle}>Öğrenciler</h1>
      <p className={styles.sub}>Son kayıt olan 100 öğrenci gösterilir; aramak için ad ya da e-posta yaz.</p>

      <form method="get" className={styles.inlineForm} style={{ marginBottom: "var(--space-5)" }}>
        <label htmlFor="q" className="visually-hidden">Öğrenci ara</label>
        <input id="q" name="q" defaultValue={q} placeholder="Ad veya e-posta" className={`${styles.input} ${styles.textInput}`} />
        <button type="submit" className={styles.buttonSecondary}>Ara</button>
      </form>

      {students.length === 0 ? (
        <div className={styles.empty}>Öğrenci bulunamadı.</div>
      ) : (
        <ul className={styles.list}>
          {students.map((s) => {
            const credits = s.purchases
              .filter((p) => p.expiresAt > now)
              .reduce((sum, p) => sum + p.remainingLessons, 0);
            return (
              <li key={s.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{s.name}</span>
                  <span className={styles.rowMeta}>
                    {s.user.email}
                    {s.phone ? ` · ${s.phone}` : ""} · kayıt: {formatDay(s.user.createdAt)}
                  </span>
                  <span className={styles.rowMeta}>
                    {[s.grade && `${s.grade}. sınıf`, s.targetExam].filter(Boolean).join(" · ") || "Sınıf/sınav bilgisi yok"}
                    {s.parentName ? ` · veli: ${s.parentName}${s.parentPhone ? ` (${s.parentPhone})` : ""}` : ""}
                  </span>
                </div>
                <div className={styles.rowSide}>
                  <span className={styles.tag}>{s._count.lessons} ders</span>
                  <span className={styles.tag}>{credits} hak</span>
                  <span className={styles.tag}>{s.hasUsedTrial ? "Deneme kullanıldı" : "Deneme hakkı var"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
