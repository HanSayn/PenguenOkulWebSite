import Link from "next/link";
import { countUnreadNotifications } from "@/lib/notifications";
import styles from "@/components/messages/messages.module.css";

// Dashboard'larda okunmamış bildirim varsa kısa bir uyarı gösterir.
export default async function UnreadNotificationsNotice({ userId, href }: { userId: string; href: string }) {
  const count = await countUnreadNotifications(userId);
  if (count === 0) return null;

  return (
    <Link href={href} className={styles.notice}>
      {count} okunmamış bildirimin var →
    </Link>
  );
}
