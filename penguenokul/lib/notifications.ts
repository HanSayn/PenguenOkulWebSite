import { prisma } from "@/lib/prisma";

export type NotificationRole = "STUDENT" | "TEACHER";

// Notification kaydında hedef bağlantı tutulmaz; tür ve role göre buradan çözülür.
const hrefs: Record<NotificationRole, Record<string, string>> = {
  STUDENT: {
    LESSON_CONFIRMED: "/ogrenci/derslerim",
    LESSON_REJECTED: "/ogrenci/ders-al",
    LESSON_EXPIRED: "/ogrenci/ders-al",
    LESSON_CANCELLED: "/ogrenci/derslerim",
    LESSON_REMINDER: "/ogrenci/derslerim",
    PACKAGE_EXPIRING: "/ogrenci/ders-al",
    NEW_MESSAGE: "/ogrenci/mesajlar",
    HOMEWORK_ASSIGNED: "/ogrenci/odevler",
    SUPPORT_REPLY: "/ogrenci/destek",
    PAYMENT_SUCCEEDED: "/ogrenci/odemeler",
    PAYMENT_FAILED: "/ogrenci/odemeler",
    PAYMENT_REFUNDED: "/ogrenci/odemeler",
  },
  TEACHER: {
    LESSON_CANCELLED: "/ogretmen/takvim",
    LESSON_REMINDER: "/ogretmen/takvim",
    NEW_MESSAGE: "/ogretmen/mesajlar",
    HOMEWORK_DONE: "/ogretmen/ogrencilerim",
    REVIEW_RECEIVED: "/ogretmen",
    SUPPORT_REPLY: "/ogretmen/destek",
    PAYOUT_SENT: "/ogretmen/kazanc",
  },
};

export const roleHomePath: Record<NotificationRole, string> = {
  STUDENT: "/ogrenci",
  TEACHER: "/ogretmen",
};

export function notificationHref(role: NotificationRole, type: string): string {
  return hrefs[role][type] ?? roleHomePath[role];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return (await prisma.notification.count({ where: { userId, isRead: false } })) as number;
}
