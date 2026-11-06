"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notificationHref, roleHomePath, type NotificationRole } from "@/lib/notifications";

async function currentUser(): Promise<{ id: string; role: NotificationRole }> {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "STUDENT" && user.role !== "TEACHER")) redirect("/giris");
  return { id: user.id, role: user.role };
}

// Bildirimi okundu yapar ve ilgili sayfaya götürür.
export async function openNotificationAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  const id = String(formData.get("notificationId") ?? "");

  const notification = (await prisma.notification.findUnique({
    where: { id },
    select: { userId: true, type: true },
  })) as { userId: string; type: string } | null;

  // Başkasının bildirimine dokunulamaz
  if (!notification || notification.userId !== user.id) redirect(`${roleHomePath[user.role]}/bildirimler`);

  await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { isRead: true } });
  revalidatePath(`${roleHomePath[user.role]}/bildirimler`);
  redirect(notificationHref(user.role, notification.type));
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await currentUser();

  await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
  revalidatePath(`${roleHomePath[user.role]}/bildirimler`);
  revalidatePath(roleHomePath[user.role]);
}
