import Link from "next/link";
import { listConversations, type Viewer } from "@/lib/messaging";
import { formatDay, formatTime } from "@/lib/format";
import panel from "@/components/ui/panel.module.css";
import styles from "./messages.module.css";

// Öğretmen ve öğrenci "Mesajlar" sayfalarının ortak gövdesi.
export default async function Inbox({ viewer, basePath }: { viewer: Viewer; basePath: string }) {
  const conversations = await listConversations(viewer);
  const otherLabel = viewer.role === "TEACHER" ? "öğrencilerinle" : "öğretmenlerinle";

  return (
    <>
      <h1 className={panel.pageTitle}>Mesajlar</h1>
      <p className={panel.sub}>
        Ders talebi gönderdiğin ya da dersini aldığın {otherLabel} buradan yazışabilirsin.
      </p>

      {conversations.length === 0 ? (
        <div className={panel.empty}>
          {viewer.role === "STUDENT" ? (
            <>
              Henüz yazışabileceğin kimse yok. Bir öğretmene ders talebi gönderince burada görünür.{" "}
              <Link href="/ogrenci/ders-al">Öğretmenleri incele</Link>
            </>
          ) : (
            "Henüz yazışabileceğin öğrenci yok. Ders talebi alınca öğrenci burada görünür."
          )}
        </div>
      ) : (
        <ul className={styles.convList}>
          {conversations.map((c) => (
            <li key={c.profileId}>
              <Link href={`${basePath}/${c.profileId}`} className={styles.conv}>
                <span className={styles.convMain}>
                  <span className={styles.convName}>{c.name}</span>
                  <span className={styles.convPreview}>
                    {c.lastContent ? `${c.lastFromMe ? "Sen: " : ""}${c.lastContent}` : "Henüz mesaj yok"}
                  </span>
                </span>
                <span className={styles.convSide}>
                  {c.lastAt && (
                    <span className={styles.convTime}>
                      {Date.now() - c.lastAt.getTime() < 24 * 3600_000 ? formatTime(c.lastAt) : formatDay(c.lastAt)}
                    </span>
                  )}
                  {c.unread > 0 && (
                    <span className={styles.badge} aria-label={`${c.unread} okunmamış mesaj`}>{c.unread}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
