import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { deleteAvailabilityAction } from "@/lib/teacher-actions";
import { formatDateTime, formatDay, ymdIstanbul } from "@/lib/format";
import AvailabilityForm from "@/components/calendar/AvailabilityForm";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Takvim" };
export const dynamic = "force-dynamic";

const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const weekOrder = [1, 2, 3, 4, 5, 6, 0];

type AvailabilityRow = {
  id: string;
  dayOfWeek: number | null;
  specificDate: Date | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};
type LessonRow = {
  id: string;
  scheduledAt: Date;
  isTrial: boolean;
  meetingLink: string | null;
  student: { name: string };
};

function RemoveButton({ id, label }: { id: string; label: string }) {
  return (
    <form action={deleteAvailabilityAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={styles.linkButton} aria-label={`${label} aralığını sil`}>
        Sil
      </button>
    </form>
  );
}

export default async function TakvimPage() {
  const { teacher } = await requireTeacher();
  const now = new Date();
  const today = ymdIstanbul(now);

  const [rows, lessons] = await Promise.all([
    prisma.availability.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startTime: "asc" },
    }) as Promise<AvailabilityRow[]>,
    prisma.lesson.findMany({
      where: { teacherId: teacher.id, status: "CONFIRMED", scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
      include: { student: { select: { name: true } } },
    }) as Promise<LessonRow[]>,
  ]);

  const recurring = rows.filter((r) => r.isRecurring);
  const specific = rows
    .filter((r) => !r.isRecurring && r.specificDate && ymdIstanbul(r.specificDate) >= today)
    .sort((a, b) => a.specificDate!.getTime() - b.specificDate!.getTime() || a.startTime.localeCompare(b.startTime));

  return (
    <>
      <h1 className={styles.pageTitle}>Takvim</h1>
      <p className={styles.sub}>Müsait olduğun saatleri belirle; öğrenciler yalnızca bu aralıklardan talep gönderebilir.</p>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Müsaitlik ekle</h2>
        <AvailabilityForm minDate={today} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Haftalık program</h2>
        {recurring.length === 0 ? (
          <div className={styles.empty}>Henüz haftalık müsaitlik eklemedin.</div>
        ) : (
          <ul className={styles.list}>
            {weekOrder.map((dow) => {
              const items = recurring.filter((r) => r.dayOfWeek === dow);
              if (items.length === 0) return null;
              return (
                <li key={dow} className={styles.row}>
                  <span className={styles.rowTitle}>{dayNames[dow]}</span>
                  <div className={styles.windows}>
                    {items.map((r) => (
                      <span key={r.id} className={styles.window}>
                        {r.startTime}–{r.endTime}
                        <RemoveButton id={r.id} label={`${dayNames[dow]} ${r.startTime}`} />
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {specific.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tek seferlik tarihler</h2>
          <ul className={styles.list}>
            {specific.map((r) => (
              <li key={r.id} className={styles.row}>
                <span className={styles.rowTitle}>{formatDay(r.specificDate!)}</span>
                <span className={styles.window}>
                  {r.startTime}–{r.endTime}
                  <RemoveButton id={r.id} label={`${ymdIstanbul(r.specificDate!)} ${r.startTime}`} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Yaklaşan onaylı dersler</h2>
        {lessons.length === 0 ? (
          <div className={styles.empty}>Yaklaşan onaylı dersin yok.</div>
        ) : (
          <ul className={styles.list}>
            {lessons.map((l) => (
              <li key={l.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {l.student.name}
                    {l.isTrial ? " (deneme)" : ""}
                  </span>
                  <span className={styles.rowMeta}>{formatDateTime(l.scheduledAt)}</span>
                </div>
                {l.meetingLink && (
                  <Link href={`/ders/${l.id}`} className={styles.buttonSecondary}>
                    Ders odası
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
