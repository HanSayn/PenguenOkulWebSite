import Link from "next/link";
import { notFound } from "next/navigation";
import { getCounterpart, loadThread, type Viewer } from "@/lib/messaging";
import { formatDateTime } from "@/lib/format";
import MessageComposer from "./MessageComposer";
import ScrollToEnd from "./ScrollToEnd";
import panel from "@/components/ui/panel.module.css";
import styles from "./messages.module.css";

type Props = {
  viewer: Viewer;
  otherProfileId: string;
  backHref: string;
  /** Öğretmen tarafında öğrenci detayına bağlantı (isteğe bağlı) */
  profileHref?: string;
};

export default async function ThreadPage({ viewer, otherProfileId, backHref, profileHref }: Props) {
  const other = await getCounterpart(viewer, otherProfileId);
  if (!other) notFound(); // ilişki yoksa varlığını da sızdırma

  const messages = await loadThread(viewer, other);

  return (
    <>
      <Link href={backHref} className={panel.back}>← Mesajlara dön</Link>
      <h1 className={panel.pageTitle}>{other.name}</h1>
      {profileHref && (
        <p className={panel.sub}>
          <Link href={profileHref}>Öğrenci takip sayfası</Link>
        </p>
      )}

      <div className={styles.thread} role="log" aria-label={`${other.name} ile yazışma`}>
        {messages.length === 0 ? (
          <p className={styles.emptyThread}>Henüz mesaj yok. İlk mesajı sen yaz.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewer.userId;
            return (
              <div key={m.id} className={`${styles.bubble} ${mine ? styles.mine : styles.theirs}`}>
                {m.content}
                <span className={styles.meta}>{formatDateTime(m.sentAt)}</span>
              </div>
            );
          })
        )}
        <ScrollToEnd count={messages.length} />
      </div>

      <MessageComposer toProfileId={other.profileId} />
    </>
  );
}
