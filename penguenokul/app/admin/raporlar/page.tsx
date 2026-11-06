import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { parseRange, REPORT_TYPES } from "@/lib/reports";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Raporlar" };
export const dynamic = "force-dynamic";

const reportLabels: Record<(typeof REPORT_TYPES)[number], string> = {
  dersler: "Dersler",
  ogretmenler: "Öğretmenler",
  ogrenciler: "Öğrenciler",
  destek: "Destek talepleri",
  denetim: "Denetim kaydı",
};

export default async function AdminRaporlarPage({ searchParams }: { searchParams: { baslangic?: string; bitis?: string } }) {
  await requireAdmin();
  const range = parseRange(searchParams.baslangic ?? null, searchParams.bitis ?? null);

  const [activeTeachers, pendingTeachers, studentCount, lessonsInRange, completed, cancelled, openTickets] = await Promise.all([
    prisma.teacherProfile.count({ where: { status: "ACTIVE" } }),
    prisma.teacherProfile.count({ where: { status: "PENDING" } }),
    prisma.studentProfile.count(),
    prisma.lesson.count({ where: { scheduledAt: { gte: range.start, lte: range.end } } }),
    prisma.lesson.count({ where: { scheduledAt: { gte: range.start, lte: range.end }, status: { in: ["COMPLETED", "NO_SHOW"] } } }),
    prisma.lesson.count({ where: { scheduledAt: { gte: range.start, lte: range.end }, status: { in: ["CANCELLED", "REJECTED", "EXPIRED"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);

  const stats = [
    { label: "Aktif öğretmen", value: activeTeachers },
    { label: "Bekleyen başvuru", value: pendingTeachers },
    { label: "Toplam öğrenci", value: studentCount },
    { label: "Seçilen aralıkta ders", value: lessonsInRange },
    { label: "Gerçekleşen ders", value: completed },
    { label: "İptal / ret / süresi dolan", value: cancelled },
    { label: "Açık destek talebi", value: openTickets },
  ];

  const qs = `baslangic=${range.from}&bitis=${range.to}`;

  return (
    <>
      <h1 className={styles.pageTitle}>Raporlar</h1>
      <p className={styles.sub}>Özet sayılar ve CSV dışa aktarma. Dosyalar Excel’de açılabilir (noktalı virgül ayraçlı, UTF-8).</p>

      <section className={styles.panel}>
        <form method="get" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "end" }}>
          <div className={styles.field}>
            <label htmlFor="baslangic" className={styles.label}>Başlangıç</label>
            <input id="baslangic" type="date" name="baslangic" defaultValue={range.from} className={styles.input} />
          </div>
          <div className={styles.field}>
            <label htmlFor="bitis" className={styles.label}>Bitiş</label>
            <input id="bitis" type="date" name="bitis" defaultValue={range.to} className={styles.input} />
          </div>
          <button type="submit" className={styles.button}>Uygula</button>
        </form>
      </section>

      <div className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.stat}>
            <p className={styles.statValue}>{s.value}</p>
            <p className={styles.statLabel}>{s.label}</p>
          </div>
        ))}
      </div>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>CSV indir</h2>
        <ul className={styles.list}>
          {REPORT_TYPES.map((t) => (
            <li key={t} className={styles.row}>
              <span className={styles.rowTitle}>{reportLabels[t]}</span>
              <a href={`/admin/raporlar/csv?tur=${t}&${qs}`} className={styles.linkButton} download>CSV indir</a>
            </li>
          ))}
        </ul>
        <p className={styles.rowMeta}>Öğrenci raporunda telefon ve veli bilgileri yer almaz. Tarih aralığı, ders ve destek raporlarında geçerlidir.</p>
      </section>
    </>
  );
}
