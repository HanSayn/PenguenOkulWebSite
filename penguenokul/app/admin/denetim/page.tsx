import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Denetim kaydı" };
export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  "teacher.approve": "Öğretmen onaylandı",
  "teacher.reject": "Öğretmen başvurusu reddedildi",
  "teacher.suspend": "Öğretmen askıya alındı",
  "teacher.reactivate": "Öğretmen yeniden etkinleştirildi",
  "lesson.cancel": "Ders iptal edildi",
  "lesson.mark": "Ders sonucu işaretlendi",
  "settings.update": "Ayarlar değiştirildi",
  "admin.2fa.enable": "İki adımlı doğrulama açıldı",
  "admin.2fa.disable": "İki adımlı doğrulama kapatıldı",
};

type Row = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  admin: { email: string };
};

const compact = (v: unknown) => (v == null ? "—" : JSON.stringify(v));

export default async function AdminDenetimPage() {
  await requireAdmin();

  const logs = (await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { admin: { select: { email: true } } },
  })) as Row[];

  return (
    <>
      <h1 className={styles.pageTitle}>Denetim kaydı</h1>
      <p className={styles.sub}>Yöneticilerin yaptığı son 100 işlem.</p>

      {logs.length === 0 ? (
        <div className={styles.empty}>Henüz kayıtlı işlem yok.</div>
      ) : (
        <ul className={styles.list}>
          {logs.map((l) => (
            <li key={l.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{actionLabels[l.action] ?? l.action}</span>
                <span className={styles.rowMeta}>
                  {formatDateTime(l.createdAt)} · {l.admin.email}
                </span>
                <span className={styles.rowMeta}>
                  {l.targetType} · {l.targetId}
                </span>
              </div>
              <div className={styles.rowMain} style={{ maxWidth: 360 }}>
                <code className={styles.rowMeta}>önce: {compact(l.before)}</code>
                <code className={styles.rowMeta}>sonra: {compact(l.after)}</code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
