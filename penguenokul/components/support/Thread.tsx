import { formatDateTime } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export type ThreadMessage = { id: string; content: string; createdAt: Date; author: { role: string; email: string } };

export default function Thread({ messages, viewerId }: { messages: (ThreadMessage & { authorId: string })[]; viewerId: string }) {
  return (
    <ul className={styles.list}>
      {messages.map((m) => {
        const mine = m.authorId === viewerId;
        const fromSupport = m.author.role === "ADMIN";
        return (
          <li key={m.id} className={styles.row} style={{ justifyContent: mine ? "flex-end" : "flex-start", borderLeft: fromSupport ? "3px solid var(--primary)" : undefined }}>
            <div className={styles.rowMain} style={{ maxWidth: 560 }}>
              <span className={styles.rowMeta}>{fromSupport ? "Penguen Okul destek" : mine ? "Sen" : "Karşı taraf"} · {formatDateTime(m.createdAt)}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
