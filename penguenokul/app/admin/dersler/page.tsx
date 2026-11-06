import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { adminCancelLessonAction, markLessonAction } from "@/lib/admin-actions";
import { formatDateTime } from "@/lib/format";
import type { LessonStatusName } from "@/lib/relations";
import LessonStatusBadge from "@/components/lessons/LessonStatusBadge";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Dersler" };
export const dynamic = "force-dynamic";

const tabs = [
  { value: "ALL", label: "Tümü" },
  { value: "REQUESTED", label: "Onay bekleyen" },
  { value: "CONFIRMED", label: "Onaylı" },
  { value: "COMPLETED", label: "Tamamlanan" },
  { value: "NO_SHOW", label: "Katılım olmayan" },
  { value: "CANCELLED", label: "İptal" },
];

const okMessages: Record<string, string> = {
  iptal: "Ders iptal edildi, öğrenci ve öğretmene bildirim gitti.",
  isaretlendi: "Ders sonucu güncellendi.",
};
const errMessages: Record<string, string> = {
  gecersiz: "Geçersiz işlem.",
  bulunamadi: "Ders bulunamadı.",
  "iptal-edilemez": "Bu ders artık iptal edilemez.",
  "durum-degismis": "Dersin durumu bu arada değişmiş. Liste yenilendi.",
  isaretlenemez: "Yalnızca saati geçmiş dersler işaretlenebilir.",
};

type Row = {
  id: string;
  scheduledAt: Date;
  durationMin: number;
  status: string;
  isTrial: boolean;
  student: { name: string };
  teacher: { name: string };
  topic: { name: string } | null;
};

export default async function AdminDerslerPage({
  searchParams,
}: {
  searchParams: { durum?: string; ok?: string; hata?: string };
}) {
  await requireAdmin();
  const filter = tabs.some((t) => t.value === searchParams.durum) ? searchParams.durum! : "ALL";
  const now = Date.now();

  const lessons = (await prisma.lesson.findMany({
    where: filter === "ALL" ? {} : { status: filter as LessonStatusName },
    orderBy: { scheduledAt: "desc" },
    take: 100,
    include: {
      student: { select: { name: true } },
      teacher: { select: { name: true } },
      topic: { select: { name: true } },
    },
  })) as Row[];

  return (
    <>
      <h1 className={styles.pageTitle}>Dersler</h1>
      <p className={styles.sub}>Son 100 ders. Gerektiğinde dersi iptal et ya da bitmiş bir dersin sonucunu düzelt.</p>

      {searchParams.ok && okMessages[searchParams.ok] && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>{okMessages[searchParams.ok]}</p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>
          {errMessages[searchParams.hata] ?? "Bir sorun oluştu."}
        </p>
      )}

      <nav className={styles.filters} aria-label="Durum filtresi">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/admin/dersler?durum=${t.value}`}
            className={`${styles.filter} ${filter === t.value ? styles.filterActive : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {lessons.length === 0 ? (
        <div className={styles.empty}>Bu filtrede ders yok.</div>
      ) : (
        <ul className={styles.list}>
          {lessons.map((l) => {
            const ended = l.scheduledAt.getTime() + l.durationMin * 60_000 <= now;
            const cancellable = (l.status === "REQUESTED" || l.status === "CONFIRMED") && !ended;
            const markable = ended && ["CONFIRMED", "COMPLETED", "NO_SHOW"].includes(l.status);
            return (
              <li key={l.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {l.student.name} → {l.teacher.name}
                    {l.isTrial ? " (deneme)" : ""}
                  </span>
                  <span className={styles.rowMeta}>
                    {formatDateTime(l.scheduledAt)} · {l.durationMin} dk{l.topic ? ` · ${l.topic.name}` : ""}
                  </span>
                </div>

                <div className={styles.rowSide}>
                  <LessonStatusBadge status={l.status} />

                  {cancellable && (
                    <form action={adminCancelLessonAction} className={styles.inlineForm}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input name="reason" maxLength={300} placeholder="Gerekçe (isteğe bağlı)" className={styles.input} aria-label="İptal gerekçesi" />
                      <button type="submit" className={styles.linkButton}>İptal et</button>
                    </form>
                  )}

                  {markable && (
                    <form action={markLessonAction} className={styles.inlineForm}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      {l.status !== "COMPLETED" && (
                        <button type="submit" name="outcome" value="COMPLETED" className={styles.buttonSecondary}>Yapıldı</button>
                      )}
                      {l.status !== "NO_SHOW" && (
                        <button type="submit" name="outcome" value="NO_SHOW" className={styles.buttonSecondary}>Katılım olmadı</button>
                      )}
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
