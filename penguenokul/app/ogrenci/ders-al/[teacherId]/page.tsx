import { getTeacherRating } from "@/lib/review-actions";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { getEntitlements, getOpenSlots } from "@/lib/booking";
import { formatDay, formatTL, formatTime, ymdIstanbul } from "@/lib/format";
import SlotPicker, { type SlotDay } from "@/components/calendar/SlotPicker";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Öğretmen profili" };
export const dynamic = "force-dynamic";

export default async function OgretmenProfilPage({ params }: { params: { teacherId: string } }) {
  const { student } = await requireStudent();

  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: params.teacherId },
    include: {
      subjects: { include: { subject: { include: { topics: { orderBy: { name: "asc" } } } } } },
      reviews: { select: { rating: true, comment: true }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!teacher || teacher.status !== "ACTIVE") notFound();

  const [slots, entitlements] = await Promise.all([
    getOpenSlots(teacher.id),
    getEntitlements(student.id, student.hasUsedTrial),
  ]);

  // Saatleri güne göre grupla
  const byDay = new Map<string, SlotDay>();
  for (const s of slots) {
    const ymd = ymdIstanbul(s);
    if (!byDay.has(ymd)) byDay.set(ymd, { ymd, label: formatDay(s), slots: [] });
    byDay.get(ymd)!.slots.push({ iso: s.toISOString(), time: formatTime(s) });
  }

  type SubjectRow = { subject: { name: string; topics: { id: string; name: string }[] } };
  const subjectRows = teacher.subjects as SubjectRow[];
  const topics = subjectRows.flatMap((s) => s.subject.topics);
  const ratings = teacher.reviews as { rating: number; comment: string | null }[];
  const { average, count } = await getTeacherRating(teacher.id);
  const avg = count ? average : null;

  return (
    <>
      <Link href="/ogrenci/ders-al" className={styles.back}>← Öğretmenlere dön</Link>

      <div className={styles.panel}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          {teacher.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teacher.photo} alt="" width={80} height={80} style={{ borderRadius: "50%", objectFit: "cover" }} />
          )}
          <h1 className={styles.pageTitle}>{teacher.name}</h1>
        </div>
        <div className={styles.tags}>
          {subjectRows.map((s) => (
            <span key={s.subject.name} className={styles.tag}>{s.subject.name}</span>
          ))}
        </div>
        {teacher.bio && <p style={{ marginTop: "var(--space-3)" }}>{teacher.bio}</p>}
        <p className={styles.rowMeta} style={{ marginBottom: 0 }}>
          {avg ? `★ ${avg.toFixed(1)} (${ratings.length} değerlendirme)` : "Henüz değerlendirme yok"}
          {teacher.osymScore ? ` · ÖSYM puanı: ${teacher.osymScore}` : ""}
          {teacher.hourlyRate > 0 && <> · <span className={styles.price}>{formatTL(teacher.hourlyRate)}</span> / saat</>}
        </p>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Ders talebi</h2>
        <SlotPicker
          teacherId={teacher.id}
          days={[...byDay.values()]}
          topics={topics}
          canTrial={entitlements.canTrial}
          canPackage={entitlements.canPackage}
        />
      </section>

      {ratings.some((r) => r.comment) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Son yorumlar</h2>
          <ul className={styles.list}>
            {ratings
              .filter((r) => r.comment)
              .map((r, i) => (
                <li key={i} className={styles.row}>
                  <span>{r.comment}</span>
                  <span className={styles.rowMeta}>★ {r.rating}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  );
}
