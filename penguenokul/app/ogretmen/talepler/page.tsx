import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { approveLessonAction, rejectLessonAction } from "@/lib/teacher-actions";
import { formatDateTime } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Talepler" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  bulunamadi: "Talep bulunamadı.",
  "zaten-yanitlandi": "Bu talep zaten yanıtlanmış.",
  "suresi-doldu": "Talebin süresi dolmuş, onaylanamaz.",
  "trial-used": "Öğrenci deneme hakkını başka bir derste kullanmış. Talebi reddedebilirsin.",
  "no-credit": "Öğrencinin kullanılabilir paket hakkı kalmamış. Talebi reddedebilirsin.",
  gorusme: "Görüşme odası oluşturulamadı. Bir görüşme bağlantısı yapıştırıp tekrar dene.",
  link: "Görüşme bağlantısı https:// ile başlamalı.",
};

type RequestRow = {
  id: string;
  scheduledAt: Date;
  isTrial: boolean;
  student: { name: string; grade: string | null; targetExam: string | null };
  topic: { name: string } | null;
  request: { expiresAt: Date } | null;
};

function remaining(expiresAt: Date, now: Date) {
  const mins = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} sa ${mins % 60} dk` : `${mins} dk`;
}

export default async function TaleplerPage({
  searchParams,
}: {
  searchParams: { onay?: string; ret?: string; hata?: string };
}) {
  const { teacher } = await requireTeacher();
  const now = new Date();

  const requests = (await prisma.lesson.findMany({
    where: {
      teacherId: teacher.id,
      status: "REQUESTED",
      scheduledAt: { gt: now },
      request: { is: { expiresAt: { gt: now } } },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      student: { select: { name: true, grade: true, targetExam: true } },
      topic: { select: { name: true } },
      request: { select: { expiresAt: true } },
    },
  })) as RequestRow[];

  return (
    <>
      <h1 className={styles.pageTitle}>Ders talepleri</h1>
      <p className={styles.sub}>Talepleri 24 saat içinde yanıtlamazsan otomatik iptal olur.</p>

      {searchParams.onay === "ok" && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Ders onaylandı, öğrenciye bildirim gitti.</p>
      )}
      {searchParams.ret === "ok" && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Talep reddedildi.</p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>
          {errors[searchParams.hata] ?? "Bir sorun oluştu."}
        </p>
      )}

      {requests.length === 0 ? (
        <div className={styles.empty}>Bekleyen talep yok.</div>
      ) : (
        <ul className={styles.list}>
          {requests.map((r) => (
            <li key={r.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {r.student.name}
                  {r.isTrial ? " · ücretsiz deneme" : ""}
                </span>
                <span className={styles.rowMeta}>
                  {formatDateTime(r.scheduledAt)}
                  {r.topic ? ` · ${r.topic.name}` : ""}
                </span>
                <span className={styles.rowMeta}>
                  {[r.student.grade && `${r.student.grade}. sınıf`, r.student.targetExam].filter(Boolean).join(" · ")}
                  {r.request ? ` · kalan süre: ${remaining(r.request.expiresAt, now)}` : ""}
                </span>
              </div>

              <div className={styles.actionsStack}>
                <form action={approveLessonAction} className={styles.inlineForm}>
                  <input type="hidden" name="lessonId" value={r.id} />
                  <input
                    name="meetingLink"
                    type="url"
                    placeholder="Kendi görüşme linkin (isteğe bağlı)"
                    className={`${styles.input} ${styles.textInput}`}
                    aria-label="Görüşme bağlantısı"
                  />
                  <button type="submit" className={styles.button}>Onayla</button>
                </form>
                <form action={rejectLessonAction} className={styles.inlineForm}>
                  <input type="hidden" name="lessonId" value={r.id} />
                  <input
                    name="reason"
                    maxLength={300}
                    placeholder="Ret gerekçesi (isteğe bağlı)"
                    className={`${styles.input} ${styles.textInput}`}
                    aria-label="Ret gerekçesi"
                  />
                  <button type="submit" className={styles.buttonSecondary}>Reddet</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
