import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { hasLessonBetween, TEACHING_STATUSES } from "@/lib/relations";
import {
  addNoteAction,
  assignHomeworkAction,
  deleteHomeworkAction,
  deleteNoteAction,
} from "@/lib/teacher-actions";
import { addDays, formatDateTime, formatDay, ymdIstanbul } from "@/lib/format";
import LessonStatusBadge from "@/components/lessons/LessonStatusBadge";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Öğrenci takibi" };
export const dynamic = "force-dynamic";

const okMessages: Record<string, string> = {
  not: "Not eklendi.",
  "not-silindi": "Not silindi.",
  odev: "Ödev verildi, öğrenciye bildirim gitti.",
  "odev-silindi": "Ödev silindi.",
};
const errMessages: Record<string, string> = {
  "not-bos": "Not boş olamaz.",
  "not-uzun": "Not en fazla 1000 karakter olabilir.",
  "odev-baslik": "Ödev başlığı 2-120 karakter olmalı.",
  "odev-uzun": "Ödev açıklaması en fazla 1000 karakter olabilir.",
  "odev-tarih": "Son tarih bugünden önce olamaz ve en fazla 90 gün sonrası seçilebilir.",
};

type StudentRow = {
  id: string;
  name: string;
  grade: string | null;
  targetExam: string | null;
  parentName: string | null;
};
type LessonRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  isTrial: boolean;
  topic: { name: string } | null;
};
type HomeworkRow = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date;
  completedAt: Date | null;
};
type NoteRow = { id: string; content: string; createdAt: Date };

export default async function OgrenciTakipPage({
  params,
  searchParams,
}: {
  params: { studentId: string };
  searchParams: { ok?: string; hata?: string };
}) {
  const { teacher } = await requireTeacher();
  const studentId = params.studentId;

  // Yalnızca ders ilişkisi olan öğrencinin sayfası açılır; aksi halde varlığı da gizlenir
  if (!(await hasLessonBetween(teacher.id, studentId, TEACHING_STATUSES))) notFound();

  const [student, lessons, homework, notes] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, grade: true, targetExam: true, parentName: true },
    }) as Promise<StudentRow | null>,
    prisma.lesson.findMany({
      where: { teacherId: teacher.id, studentId, status: { in: TEACHING_STATUSES } },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      select: { id: true, scheduledAt: true, status: true, isTrial: true, topic: { select: { name: true } } },
    }) as Promise<LessonRow[]>,
    prisma.homework.findMany({
      where: { teacherId: teacher.id, studentId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }) as Promise<HomeworkRow[]>,
    prisma.teacherNote.findMany({
      where: { teacherId: teacher.id, studentId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }) as Promise<NoteRow[]>,
  ]);
  if (!student) notFound();

  const now = new Date();
  const today = ymdIstanbul(now);

  return (
    <>
      <Link href="/ogretmen/ogrencilerim" className={styles.back}>← Öğrencilerime dön</Link>

      <div className={styles.panel}>
        <h1 className={styles.pageTitle}>{student.name}</h1>
        <p className={styles.rowMeta} style={{ marginTop: 0 }}>
          {[student.grade && `${student.grade}. sınıf`, student.targetExam, student.parentName && `Veli: ${student.parentName}`]
            .filter(Boolean)
            .join(" · ") || "Ek bilgi yok"}
        </p>
        <Link href={`/ogretmen/mesajlar/${student.id}`} className={styles.buttonSecondary} style={{ display: "inline-block" }}>
          Mesaj gönder
        </Link>
      </div>

      {searchParams.ok && okMessages[searchParams.ok] && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>{okMessages[searchParams.ok]}</p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>
          {errMessages[searchParams.hata] ?? "Bir sorun oluştu."}
        </p>
      )}

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Ödevler</h2>

        <form action={assignHomeworkAction} className={styles.actionsStack} style={{ marginBottom: "var(--space-5)" }}>
          <input type="hidden" name="studentId" value={student.id} />
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="hw-title" className={styles.label}>Başlık</label>
              <input id="hw-title" name="title" required maxLength={120} className={`${styles.input} ${styles.textInput}`} />
            </div>
            <div className={styles.field}>
              <label htmlFor="hw-due" className={styles.label}>Son tarih</label>
              <input id="hw-due" name="due" type="date" required min={today} max={addDays(today, 90)} defaultValue={addDays(today, 7)} className={styles.input} />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="hw-desc" className={styles.label}>Açıklama (isteğe bağlı)</label>
            <textarea
              id="hw-desc"
              name="description"
              rows={3}
              maxLength={1000}
              className={styles.input}
              style={{ width: "100%", maxWidth: 560, resize: "vertical" }}
            />
          </div>
          <div>
            <button type="submit" className={styles.button}>Ödev ver</button>
          </div>
        </form>

        {homework.length === 0 ? (
          <div className={styles.empty}>Bu öğrenciye henüz ödev vermedin.</div>
        ) : (
          <ul className={styles.list}>
            {homework.map((h) => {
              const overdue = !h.completedAt && h.dueAt < now;
              return (
                <li key={h.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{h.title}</span>
                    {h.description && <span className={styles.rowMeta}>{h.description}</span>}
                    <span className={styles.rowMeta}>Son tarih: {formatDay(h.dueAt)}</span>
                  </div>
                  <div className={styles.rowSide}>
                    <span className={`${styles.tag} ${overdue ? styles.warn : ""}`}>
                      {h.completedAt ? `Tamamlandı · ${formatDay(h.completedAt)}` : overdue ? "Süresi geçti" : "Bekliyor"}
                    </span>
                    <form action={deleteHomeworkAction}>
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="homeworkId" value={h.id} />
                      <button type="submit" className={styles.linkButton} aria-label={`${h.title} ödevini sil`}>Sil</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Özel notlar</h2>
        <p className={styles.rowMeta} style={{ marginTop: 0 }}>Yalnızca sen görürsün; öğrenci ve veli göremez.</p>

        <form action={addNoteAction} className={styles.actionsStack} style={{ marginBottom: "var(--space-5)" }}>
          <input type="hidden" name="studentId" value={student.id} />
          <label htmlFor="note" className="visually-hidden">Yeni not</label>
          <textarea
            id="note"
            name="content"
            rows={3}
            maxLength={1000}
            required
            placeholder="Örn. Türev konusunda zincir kuralını tekrar etmeli."
            className={styles.input}
            style={{ width: "100%", maxWidth: 560, resize: "vertical" }}
          />
          <div>
            <button type="submit" className={styles.button}>Not ekle</button>
          </div>
        </form>

        {notes.length === 0 ? (
          <div className={styles.empty}>Henüz not eklemedin.</div>
        ) : (
          <ul className={styles.list}>
            {notes.map((n) => (
              <li key={n.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.content}</span>
                  <span className={styles.rowMeta}>{formatDateTime(n.createdAt)}</span>
                </div>
                <form action={deleteNoteAction}>
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="noteId" value={n.id} />
                  <button type="submit" className={styles.linkButton} aria-label="Notu sil">Sil</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ders geçmişi</h2>
        <ul className={styles.list}>
          {lessons.map((l) => (
            <li key={l.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {formatDateTime(l.scheduledAt)}
                  {l.isTrial ? " (deneme)" : ""}
                </span>
                {l.topic && <span className={styles.rowMeta}>{l.topic.name}</span>}
              </div>
              <LessonStatusBadge status={l.status} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
