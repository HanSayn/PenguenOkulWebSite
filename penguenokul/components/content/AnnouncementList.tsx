import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

// Panellerde kitleye uygun yayınlanmış son 3 duyuru
export default async function AnnouncementList({ audience }: { audience: "STUDENT" | "TEACHER" }) {
  const items = await prisma.announcement.findMany({
    where: { published: true, audience: { in: ["ALL", audience] } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, body: true, createdAt: true },
  });
  if (items.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Duyurular</h2>
      <ul className={styles.list}>
        {items.map((a) => (
          <li key={a.id} className={styles.row}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{a.title}</span>
              <span className={styles.rowMeta}>{formatDateTime(a.createdAt)}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{a.body}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
