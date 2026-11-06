import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import LessonStatusBadge from "@/components/lessons/LessonStatusBadge";
import UnreadNotice from "@/components/messages/UnreadNotice";
import AnnouncementList from "@/components/content/AnnouncementList";
import styles from "@/components/ui/panel.module.css";

export const dynamic = "force-dynamic";

export default async function OgrenciDashboard() {
  const { student } = await requireStudent();
  const now = new Date();

  const [upcoming, purchases, unread, activeTrial] = await Promise.all([
    prisma.lesson.findMany({
      where: { studentId: student.id, scheduledAt: { gte: now }, status: { in: ["REQUESTED", "CONFIRMED"] } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { teacher: { select: { name: true } }, topic: { select: { name: true } } },
    }),
    prisma.purchase.findMany({
      where: { studentId: student.id, expiresAt: { gt: now }, remainingLessons: { gt: 0 } },
      select: { remainingLessons: true },
    }),
    prisma.notification.count({ where: { userId: student.userId, isRead: false } }),
    prisma.lesson.findFirst({
      where: { studentId: student.id, isTrial: true, status: { in: ["REQUESTED", "CONFIRMED", "COMPLETED", "NO_SHOW"] } },
      select: { id: true },
    }),
  ]);

  const remaining = purchases.reduce((sum: number, p: { remainingLessons: number }) => sum + p.remainingLessons, 0);
  const trialAvailable = !student.hasUsedTrial && !activeTrial;

  return (
    <>
      <h1 className={styles.pageTitle}>Merhaba, {student.name.split(" ")[0]} 👋</h1>
      <p className={styles.sub}>Yaklaşan derslerin ve kalan haklarının özeti.</p>
      <AnnouncementList audience="STUDENT" />

      <UnreadNotice userId={student.userId} href="/ogrenci/mesajlar" />

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statValue}>{remaining}</p>
          <p className={styles.statLabel}>Kalan ders hakkı</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{trialAvailable ? "1" : "0"}</p>
          <p className={styles.statLabel}>Ücretsiz deneme dersi</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{unread}</p>
          <p className={styles.statLabel}>
            <Link href="/ogrenci/bildirimler">Okunmamış bildirim</Link>
          </p>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Yaklaşan dersler</h2>
        {upcoming.length === 0 ? (
          <div className={styles.empty}>
            Henüz planlanmış dersin yok. <Link href="/ogrenci/ders-al">Öğretmenleri incele</Link> ve ilk dersini al.
          </div>
        ) : (
          <ul className={styles.list}>
            {upcoming.map(
              (l: {
                id: string;
                scheduledAt: Date;
                status: string;
                isTrial: boolean;
                teacher: { name: string };
                topic: { name: string } | null;
              }) => (
                <li key={l.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>
                      {l.teacher.name}
                      {l.topic ? ` · ${l.topic.name}` : ""}
                      {l.isTrial ? " (deneme)" : ""}
                    </span>
                    <span className={styles.rowMeta}>{formatDateTime(l.scheduledAt)}</span>
                  </div>
                  <LessonStatusBadge status={l.status} />
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <Link href="/ogrenci/ders-al" className={styles.button} style={{ display: "inline-block" }}>
        Yeni ders al
      </Link>
    </>
  );
}
