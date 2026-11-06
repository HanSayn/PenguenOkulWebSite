import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { TEACHING_STATUSES } from "@/lib/relations";
import { formatDateTime } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Öğrencilerim" };
export const dynamic = "force-dynamic";

type LessonRow = {
  scheduledAt: Date;
  status: string;
  student: { id: string; name: string; grade: string | null; targetExam: string | null };
};

type Summary = {
  id: string;
  name: string;
  grade: string | null;
  targetExam: string | null;
  completed: number;
  upcoming: number;
  nextAt: Date | null;
  lastAt: Date | null;
  openHomework: number;
};

export default async function OgrencilerimPage({ searchParams }: { searchParams: { hata?: string } }) {
  const { teacher } = await requireTeacher();
  const now = new Date();

  const [lessons, openHomework] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId: teacher.id, status: { in: TEACHING_STATUSES } },
      orderBy: { scheduledAt: "desc" },
      take: 500,
      select: {
        scheduledAt: true,
        status: true,
        student: { select: { id: true, name: true, grade: true, targetExam: true } },
      },
    }) as Promise<LessonRow[]>,
    prisma.homework.findMany({
      where: { teacherId: teacher.id, completedAt: null },
      select: { studentId: true },
    }) as Promise<{ studentId: string }[]>,
  ]);

  const homeworkCount = new Map<string, number>();
  for (const h of openHomework) homeworkCount.set(h.studentId, (homeworkCount.get(h.studentId) ?? 0) + 1);

  const byStudent = new Map<string, Summary>();
  for (const l of lessons) {
    let s = byStudent.get(l.student.id);
    if (!s) {
      s = {
        ...l.student,
        completed: 0,
        upcoming: 0,
        nextAt: null,
        lastAt: null,
        openHomework: homeworkCount.get(l.student.id) ?? 0,
      };
      byStudent.set(l.student.id, s);
    }
    if (l.status === "COMPLETED") s.completed++;
    if (l.status === "CONFIRMED" && l.scheduledAt >= now) {
      s.upcoming++;
      // dersler yeniden eskiye sıralı: en son görülen en yakın gelecek derstir
      s.nextAt = l.scheduledAt;
    } else if (l.scheduledAt < now && !s.lastAt) {
      s.lastAt = l.scheduledAt;
    }
  }

  const students = [...byStudent.values()].sort((a, b) => {
    if (a.nextAt && b.nextAt) return a.nextAt.getTime() - b.nextAt.getTime();
    if (a.nextAt) return -1;
    if (b.nextAt) return 1;
    return (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0);
  });

  return (
    <>
      <h1 className={styles.pageTitle}>Öğrencilerim</h1>
      <p className={styles.sub}>Onaylı ya da tamamlanmış dersin olan öğrenciler. Not almak ve ödev vermek için bir öğrenci seç.</p>

      {searchParams.hata === "bulunamadi" && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>Öğrenci bulunamadı.</p>
      )}

      {students.length === 0 ? (
        <div className={styles.empty}>Henüz öğrencin yok. İlk dersin onaylanınca öğrenci burada görünür.</div>
      ) : (
        <ul className={styles.list}>
          {students.map((s) => (
            <li key={s.id} className={styles.row}>
              <div className={styles.rowMain}>
                <Link href={`/ogretmen/ogrencilerim/${s.id}`} className={styles.rowTitle}>{s.name}</Link>
                <span className={styles.rowMeta}>
                  {[s.grade && `${s.grade}. sınıf`, s.targetExam].filter(Boolean).join(" · ") || "Sınıf/sınav bilgisi yok"}
                </span>
                <span className={styles.rowMeta}>
                  {s.nextAt ? `Sonraki ders: ${formatDateTime(s.nextAt)}` : "Planlanmış ders yok"}
                </span>
              </div>
              <div className={styles.rowSide}>
                <span className={styles.tag}>{s.completed} ders yapıldı</span>
                {s.openHomework > 0 && <span className={styles.tag}>{s.openHomework} açık ödev</span>}
                <Link href={`/ogretmen/mesajlar/${s.id}`} className={styles.buttonSecondary}>Mesaj</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
