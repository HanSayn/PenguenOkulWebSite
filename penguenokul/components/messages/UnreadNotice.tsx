import Link from "next/link";
import { countUnreadMessages } from "@/lib/messaging";
import styles from "./messages.module.css";

// Dashboard'larda okunmamış mesaj varsa kısa bir uyarı gösterir.
export default async function UnreadNotice({ userId, href }: { userId: string; href: string }) {
  const count = await countUnreadMessages(userId);
  if (count === 0) return null;

  return (
    <Link href={href} className={styles.notice}>
      {count} okunmamış mesajın var →
    </Link>
  );
}
