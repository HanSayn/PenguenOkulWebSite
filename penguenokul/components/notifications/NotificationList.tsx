import { prisma } from "@/lib/prisma";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/notification-actions";
import { formatDateTime } from "@/lib/format";
import panel from "@/components/ui/panel.module.css";
import styles from "./notifications.module.css";

type Row = { id: string; title: string; body: string; isRead: boolean; createdAt: Date };

// Öğrenci ve öğretmen "Bildirimler" sayfalarının ortak gövdesi.
export default async function NotificationList({ userId }: { userId: string }) {
  const notifications = (await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, isRead: true, createdAt: true },
  })) as Row[];

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <h1 className={panel.pageTitle}>Bildirimler</h1>
      <p className={panel.sub}>Son 50 bildirimin. Birine tıklayınca okundu olur ve ilgili sayfaya gidersin.</p>

      {unread > 0 && (
        <form action={markAllNotificationsReadAction} className={styles.toolbar}>
          <button type="submit" className={panel.buttonSecondary}>Tümünü okundu say ({unread})</button>
        </form>
      )}

      {notifications.length === 0 ? (
        <div className={panel.empty}>Henüz bildirimin yok.</div>
      ) : (
        <ul className={styles.list}>
          {notifications.map((n) => (
            <li key={n.id}>
              <form action={openNotificationAction}>
                <input type="hidden" name="notificationId" value={n.id} />
                <button type="submit" className={`${styles.item} ${n.isRead ? "" : styles.unread}`}>
                  <span className={styles.head}>
                    <span className={styles.title}>
                      {!n.isRead && <span className="visually-hidden">Okunmamış: </span>}
                      {n.title}
                    </span>
                    <span className={styles.time}>{formatDateTime(n.createdAt)}</span>
                  </span>
                  <span className={styles.body}>{n.body}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
