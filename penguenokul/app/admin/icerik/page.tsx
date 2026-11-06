import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { toggleAnnouncementAction, deleteAnnouncementAction, toggleFaqAction, deleteFaqAction } from "@/lib/content-actions";
import { AnnouncementForm, FaqForm } from "@/components/content/ContentForms";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "İçerik" };
export const dynamic = "force-dynamic";

const audienceLabel: Record<string, string> = { ALL: "Herkes", STUDENT: "Öğrenciler", TEACHER: "Öğretmenler" };

export default async function AdminIcerikPage() {
  await requireAdmin();
  const [announcements, faqs] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.faqItem.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] }),
  ]);

  return (
    <>
      <h1 className={styles.pageTitle}>İçerik</h1>
      <p className={styles.sub}>Panellerde görünen duyurular ve herkese açık sık sorulan sorular (/sss).</p>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Duyurular</h2>
        <AnnouncementForm />
        <ul className={styles.list} style={{ marginTop: "var(--space-4)" }}>
          {announcements.map((a) => (
            <li key={a.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{a.title}{!a.published && " (taslak)"}</span>
                <span className={styles.rowMeta}>{audienceLabel[a.audience] ?? a.audience} · {formatDateTime(a.createdAt)}</span>
                <span>{a.body}</span>
              </div>
              <div className={styles.rowSide}>
                <form action={toggleAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className={styles.linkButton}>{a.published ? "Gizle" : "Yayınla"}</button>
                </form>
                <form action={deleteAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className={styles.linkButton}>Sil</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Sık sorulan sorular</h2>
        <FaqForm />
        <ul className={styles.list} style={{ marginTop: "var(--space-4)" }}>
          {faqs.map((f) => (
            <li key={f.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{f.question}{!f.published && " (taslak)"}</span>
                <span className={styles.rowMeta}>Sıra: {f.order}</span>
                <span>{f.answer}</span>
              </div>
              <div className={styles.rowSide}>
                <form action={toggleFaqAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className={styles.linkButton}>{f.published ? "Gizle" : "Yayınla"}</button>
                </form>
                <form action={deleteFaqAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className={styles.linkButton}>Sil</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
