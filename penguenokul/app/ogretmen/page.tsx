import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { addDays, formatDateTime, formatTime, istanbulDate, ymdIstanbul } from "@/lib/format";
import UnreadNotice from "@/components/messages/UnreadNotice";
import UnreadNotificationsNotice from "@/components/notifications/UnreadNotificationsNotice";
import AnnouncementList from "@/components/content/AnnouncementList";
import styles from "@/components/ui/panel.module.css";

export const dynamic = "force-dynamic";

type TodayLesson = {
  id: string;
  scheduledAt: Date;
  isTrial: boolean;
  meetingLink: string | null;
  student: { name: string };
  topic: { name: string } | null;
};

export default async function OgretmenDashboard() {
  const { user, teacher } = await requireTeacher();
  const now = new Date();
  const today = ymdIstanbul(now);
  const dayStart = istanbulDate(today, "00:00");
  const dayEnd = istanbulDate(addDays(today, 1), "00:00");

  const [todayLessons, pending, upcomingCount, availabilityCount, subjectCount] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId: teacher.id, status: "CONFIRMED", scheduledAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { scheduledAt: "asc" },
      include: { student: { select: { name: true } }, topic: { select: { name: true } } },
    }) as Promise<TodayLesson[]>,
    prisma.lesson.count({
      where: { teacherId: teacher.id, status: "REQUESTED", request: { is: { expiresAt: { gt: now } } } },
    }) as Promise<number>,
    prisma.lesson.count({
      where: { teacherId: teacher.id, status: "CONFIRMED", scheduledAt: { gte: now } },
    }) as Promise<number>,
    prisma.availability.count({ where: { teacherId: teacher.id } }) as Promise<number>,
    prisma.teacherSubject.count({ where: { teacherId: teacher.id } }) as Promise<number>,
  ]);

  return (
    <>
      <h1 className={styles.pageTitle}>Merhaba, {teacher.name.split(" ")[0]} 👋</h1>
      <p className={styles.sub}>Bugünkü derslerin ve bekleyen taleplerin özeti.</p>
      <AnnouncementList audience="TEACHER" />

      <UnreadNotice userId={user.id} href="/ogretmen/mesajlar" />
      <UnreadNotificationsNotice userId={user.id} href="/ogretmen/bildirimler" />

      {teacher.status === "PENDING" && (
        <p role="status" className={`${styles.alert} ${styles.warn}`}>
          Başvurun inceleniyor. Admin onayına kadar öğrenciler seni listede göremez; bu sürede{" "}
          <Link href="/ogretmen/profil">profilini</Link> ve <Link href="/ogretmen/takvim">müsaitliklerini</Link> hazırlayabilirsin.
        </p>
      )}
      {subjectCount === 0 && (
        <p role="status" className={`${styles.alert} ${styles.warn}`}>
          Henüz branş seçmedin; branşı olmayan başvurular onaylanamaz. <Link href="/ogretmen/profil">Profilini tamamla</Link>
        </p>
      )}
      {teacher.status === "ACTIVE" && availabilityCount === 0 && (
        <p role="status" className={`${styles.alert} ${styles.warn}`}>
          Henüz müsait saat eklemedin, bu yüzden öğrenciler sana talep gönderemez. <Link href="/ogretmen/takvim">Müsaitlik ekle</Link>
        </p>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statValue}>{todayLessons.length}</p>
          <p className={styles.statLabel}>Bugünkü ders</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{pending}</p>
          <p className={styles.statLabel}>Bekleyen talep</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{upcomingCount}</p>
          <p className={styles.statLabel}>Yaklaşan onaylı ders</p>
        </div>
      </div>

      {pending > 0 && (
        <p>
          <Link href="/ogretmen/talepler" className={styles.button} style={{ display: "inline-block" }}>
            {pending} talebi yanıtla
          </Link>
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bugünkü dersler</h2>
        {todayLessons.length === 0 ? (
          <div className={styles.empty}>Bugün için onaylı dersin yok.</div>
        ) : (
          <ul className={styles.list}>
            {todayLessons.map((l) => (
              <li key={l.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {formatTime(l.scheduledAt)} · {l.student.name}
                    {l.topic ? ` · ${l.topic.name}` : ""}
                    {l.isTrial ? " (deneme)" : ""}
                  </span>
                  <span className={styles.rowMeta}>{formatDateTime(l.scheduledAt)}</span>
                </div>
                {l.meetingLink && (
                  <Link href={`/ders/${l.id}`} className={styles.buttonSecondary}>
                    Derse git
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
