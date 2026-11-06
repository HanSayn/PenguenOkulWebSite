import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { formatTL } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Ders al" };
export const dynamic = "force-dynamic";

type TeacherRow = {
  id: string;
  name: string;
  bio: string | null;
  hourlyRate: number;
  subjects: { subject: { name: string } }[];
  reviews: { rating: number }[];
};

export default async function DersAlPage({ searchParams }: { searchParams: { ders?: string } }) {
  await requireStudent();
  const slug = searchParams.ders;

  const [subjects, teachers] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" } }) as Promise<{ slug: string; name: string }[]>,
    prisma.teacherProfile.findMany({
      where: {
        status: "ACTIVE",
        ...(slug ? { subjects: { some: { subject: { slug } } } } : {}),
      },
      include: {
        subjects: { include: { subject: { select: { name: true } } } },
        reviews: { select: { rating: true } },
      },
      orderBy: { name: "asc" },
    }) as Promise<TeacherRow[]>,
  ]);

  return (
    <>
      <h1 className={styles.pageTitle}>Öğretmenini seç</h1>
      <p className={styles.sub}>Branşa göre filtrele, profili incele ve müsait saatten ders talebi gönder.</p>

      <nav className={styles.filters} aria-label="Ders filtresi">
        <Link href="/ogrenci/ders-al" className={`${styles.filter} ${!slug ? styles.filterActive : ""}`}>
          Tümü
        </Link>
        {subjects.map((s) => (
          <Link
            key={s.slug}
            href={`/ogrenci/ders-al?ders=${s.slug}`}
            className={`${styles.filter} ${slug === s.slug ? styles.filterActive : ""}`}
          >
            {s.name}
          </Link>
        ))}
      </nav>

      {teachers.length === 0 ? (
        <div className={styles.empty}>Bu filtreye uygun aktif öğretmen bulunamadı.</div>
      ) : (
        <div className={styles.cards}>
          {teachers.map((t) => {
            const avg = t.reviews.length
              ? t.reviews.reduce((s, r) => s + r.rating, 0) / t.reviews.length
              : null;
            return (
              <Link key={t.id} href={`/ogrenci/ders-al/${t.id}`} className={styles.card}>
                <h2 className={styles.cardName}>{t.name}</h2>
                <div className={styles.tags}>
                  {t.subjects.map((s) => (
                    <span key={s.subject.name} className={styles.tag}>{s.subject.name}</span>
                  ))}
                </div>
                {t.bio && <p className={styles.cardBio}>{t.bio}</p>}
                <p className={styles.rowMeta} style={{ margin: 0 }}>
                  {avg ? `★ ${avg.toFixed(1)} (${t.reviews.length} değerlendirme)` : "Henüz değerlendirme yok"}
                  {t.hourlyRate > 0 && <> · <span className={styles.price}>{formatTL(t.hourlyRate)}</span> / saat</>}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
