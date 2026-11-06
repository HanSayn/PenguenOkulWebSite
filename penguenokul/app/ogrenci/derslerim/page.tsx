import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { cancelLessonAction } from "@/lib/student-actions";
import { formatDateTime } from "@/lib/format";
import { getNumberSetting } from "@/lib/settings";
import ReviewForm from "@/components/reviews/ReviewForm";
import Stars from "@/components/reviews/Stars";
import LessonStatusBadge from "@/components/lessons/LessonStatusBadge";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Derslerim" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  bulunamadi: "Ders bulunamadı.",
  "iptal-edilemez": "Bu ders artık iptal edilemez.",
  "iptal-suresi": "İptal süresi geçtiği için bu dersi iptal edemezsin.",
};

type LessonRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  isTrial: boolean;
  durationMin: number;
  meetingLink: string | null;
  teacher: { name: string };
  topic: { name: string } | null;
  review: { rating: number } | null;
};

export default async function DerslerimPage({
  searchParams,
}: {
  searchParams: { talep?: string; iptal?: string; hata?: string };
}) {
  const { student } = await requireStudent();
  const now = new Date();
  const joinOpensMin = await getNumberSetting("meetingLinkOpensMinutesBefore", 15);

  const lessons = (await prisma.lesson.findMany({
    where: { studentId: student.id },
    orderBy: { scheduledAt: "desc" },
    take: 50,
    include: { teacher: { select: { name: true } }, topic: { select: { name: true } }, review: { select: { rating: true } } },
  })) as LessonRow[];

  const isUpcoming = (l: LessonRow) =>
    l.scheduledAt >= now && (l.status === "REQUESTED" || l.status === "CONFIRMED");
  const upcoming = lessons.filter(isUpcoming).reverse(); // en yakın üstte
  const past = lessons.filter((l) => !isUpcoming(l));

  // Bağlantı yalnızca sunucuda, ders başlamadan joinOpensMin dk önce ile bitişi arasında sayfaya yazılır.
  const canJoin = (l: LessonRow) =>
    l.status === "CONFIRMED" &&
    !!l.meetingLink &&
    now.getTime() >= l.scheduledAt.getTime() - joinOpensMin * 60_000 &&
    now.getTime() <= l.scheduledAt.getTime() + l.durationMin * 60_000;

  const renderRow = (l: LessonRow, canCancel: boolean) => (
    <li key={l.id} className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {l.teacher.name}
          {l.topic ? ` · ${l.topic.name}` : ""}
          {l.isTrial ? " (deneme)" : ""}
        </span>
        <span className={styles.rowMeta}>{formatDateTime(l.scheduledAt)}</span>
        {l.status === "COMPLETED" && l.review && <Stars value={l.review.rating} />}
        {l.status === "COMPLETED" && !l.review && <ReviewForm lessonId={l.id} />}
        {canCancel && l.status === "CONFIRMED" && !canJoin(l) && (
          <span className={styles.rowMeta}>Görüşme bağlantısı ders başlamadan {joinOpensMin} dk önce açılır.</span>
        )}
      </div>
      <div className={styles.rowSide}>
        {canJoin(l) && (
          <Link href={`/ders/${l.id}`} className={styles.button}>
            Derse katıl
          </Link>
        )}
        <LessonStatusBadge status={l.status} />
        {canCancel && (
          <form action={cancelLessonAction}>
            <input type="hidden" name="lessonId" value={l.id} />
            <button type="submit" className={styles.linkButton}>
              {l.status === "REQUESTED" ? "Talebi geri çek" : "İptal et"}
            </button>
          </form>
        )}
      </div>
    </li>
  );

  return (
    <>
      <h1 className={styles.pageTitle}>Derslerim</h1>
      <p className={styles.sub}>Taleplerini, onaylı derslerini ve geçmiş derslerini buradan takip edebilirsin.</p>

      {searchParams.talep === "ok" && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>
          Talebin öğretmene iletildi. Yanıt gelince durumu burada göreceksin.
        </p>
      )}
      {searchParams.iptal === "ok" && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Ders iptal edildi.</p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>
          {errors[searchParams.hata] ?? "Bir sorun oluştu."}
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Yaklaşan</h2>
        {upcoming.length === 0 ? (
          <div className={styles.empty}>
            Yaklaşan dersin yok. <Link href="/ogrenci/ders-al">Ders al</Link>
          </div>
        ) : (
          <ul className={styles.list}>{upcoming.map((l) => renderRow(l, true))}</ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Geçmiş</h2>
        {past.length === 0 ? (
          <div className={styles.empty}>Geçmiş ders kaydın yok.</div>
        ) : (
          <ul className={styles.list}>{past.map((l) => renderRow(l, false))}</ul>
        )}
      </section>
    </>
  );
}
