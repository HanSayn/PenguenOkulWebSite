import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { addDays, formatDay, istanbulDate, ymdIstanbul } from "@/lib/format";
import BarList from "@/components/charts/BarList";
import styles from "@/components/ui/panel.module.css";

export const dynamic = "force-dynamic";

const STATUS_ROWS = [
  { status: "REQUESTED", label: "Onay bekleyen" },
  { status: "CONFIRMED", label: "Onaylı" },
  { status: "COMPLETED", label: "Tamamlanan" },
  { status: "CANCELLED", label: "İptal edilen" },
  { status: "EXPIRED", label: "Yanıtsız kalan" },
] as const;

export default async function AdminDashboard() {
  await requireAdmin();
  const now = new Date();
  const today = ymdIstanbul(now);
  const rangeStart = istanbulDate(today, "00:00");
  const rangeEnd = istanbulDate(addDays(today, 7), "00:00");

  const [pendingTeachers, activeTeachers, students, nextWeek, ...statusCounts] = await Promise.all([
    prisma.teacherProfile.count({ where: { status: "PENDING" } }) as Promise<number>,
    prisma.teacherProfile.count({ where: { status: "ACTIVE" } }) as Promise<number>,
    prisma.studentProfile.count() as Promise<number>,
    prisma.lesson.findMany({
      where: { status: { in: ["REQUESTED", "CONFIRMED"] }, scheduledAt: { gte: rangeStart, lt: rangeEnd } },
      select: { scheduledAt: true },
    }) as Promise<{ scheduledAt: Date }[]>,
    ...STATUS_ROWS.map((r) => prisma.lesson.count({ where: { status: r.status } }) as Promise<number>),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const ymd = addDays(today, i);
    return {
      label: formatDay(istanbulDate(ymd, "12:00")),
      value: nextWeek.filter((l) => ymdIstanbul(l.scheduledAt) === ymd).length,
    };
  });

  return (
    <>
      <h1 className={styles.pageTitle}>Yönetim paneli</h1>
      <p className={styles.sub}>Platformun anlık durumu.</p>

      {pendingTeachers > 0 && (
        <p role="status" className={`${styles.alert} ${styles.warn}`}>
          {pendingTeachers} öğretmen başvurusu onay bekliyor.{" "}
          <Link href="/admin/ogretmenler?durum=PENDING">Başvuruları incele</Link>
        </p>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statValue}>{activeTeachers}</p>
          <p className={styles.statLabel}>Aktif öğretmen</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{pendingTeachers}</p>
          <p className={styles.statLabel}>Bekleyen başvuru</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{students}</p>
          <p className={styles.statLabel}>Öğrenci</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{nextWeek.length}</p>
          <p className={styles.statLabel}>Önümüzdeki 7 günde ders</p>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Önümüzdeki 7 gün</h2>
        <BarList items={days} />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Derslerin durumu</h2>
        <BarList items={STATUS_ROWS.map((r, i) => ({ label: r.label, value: statusCounts[i] }))} />
      </section>
    </>
  );
}
