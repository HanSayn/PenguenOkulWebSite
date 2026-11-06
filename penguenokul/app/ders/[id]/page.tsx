import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNumberSetting } from "@/lib/settings";
import { canEmbedMeeting } from "@/lib/meeting";
import { isJoinable, joinWindow } from "@/lib/lesson-room";
import { formatDateTime } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Ders odası", robots: { index: false } };
export const dynamic = "force-dynamic";

// Ders odası: yalnızca dersin öğrencisi ve öğretmeni girebilir, yalnızca onaylı ve zamanı gelmiş derslerde.
export default async function DersOdasi({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      durationMin: true,
      meetingLink: true,
      student: { select: { userId: true, name: true } },
      teacher: { select: { userId: true, name: true } },
    },
  });
  const uid = session.user.id;
  // Başkasının dersi ile var olmayan ders aynı yanıtı verir
  if (!lesson || (lesson.student.userId !== uid && lesson.teacher.userId !== uid)) notFound();

  const isStudent = lesson.student.userId === uid;
  const back = isStudent ? "/ogrenci/derslerim" : "/ogretmen/takvim";
  const opensMin = await getNumberSetting("meetingLinkOpensMinutesBefore", 15);
  const now = new Date();
  const w = joinWindow(lesson.scheduledAt, lesson.durationMin, opensMin);
  const other = isStudent ? lesson.teacher.name : lesson.student.name;

  let notice: string | null = null;
  if (lesson.status !== "CONFIRMED") notice = "Bu ders onaylı değil, görüşme odası açılamaz.";
  else if (!lesson.meetingLink) notice = "Bu ders için henüz görüşme bağlantısı oluşturulmamış.";
  else if (!isJoinable(now, lesson.scheduledAt, lesson.durationMin, opensMin)) {
    notice =
      now < w.opensAt
        ? `Oda ${formatDateTime(w.opensAt)} tarihinde açılır.`
        : "Bu dersin görüşme süresi sona erdi.";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-5) 16px" }}>
      <p><Link href={back} className={styles.rowMeta}>← Derslerime dön</Link></p>
      <h1 className={styles.pageTitle}>{other} ile ders</h1>
      <p className={styles.sub}>{formatDateTime(lesson.scheduledAt)} · {lesson.durationMin} dk</p>

      {notice || !lesson.meetingLink ? (
        <div className={styles.empty}>{notice}</div>
      ) : canEmbedMeeting(lesson.meetingLink) ? (
        <>
          <iframe
            title="Görüşme odası"
            src={lesson.meetingLink}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ width: "100%", height: "min(75vh, 700px)", minHeight: 420, border: 0, borderRadius: 12, background: "#111" }}
          />
          <p className={styles.rowMeta} style={{ marginTop: "var(--space-3)" }}>
            Kamera veya mikrofon açılmıyorsa tarayıcı izinlerini kontrol et ya da{" "}
            <a href={lesson.meetingLink} target="_blank" rel="noopener noreferrer">odayı yeni sekmede aç</a>.
          </p>
        </>
      ) : (
        <p>
          <a href={lesson.meetingLink} target="_blank" rel="noopener noreferrer" className={styles.button}>
            Görüşmeye katıl
          </a>
        </p>
      )}
    </main>
  );
}
