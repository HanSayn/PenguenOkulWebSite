import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { renderNotificationEmail } from "@/lib/email-templates";

export type NotifyInput = {
  userId: string;
  type: string; // LESSON_CONFIRMED, LESSON_REJECTED, LESSON_EXPIRED, LESSON_REMINDER, PACKAGE_EXPIRING ...
  title: string;
  body: string;
  /** Aynı anahtarla ikinci bildirim oluşturulmaz (zamanlanmış işler için). */
  dedupeKey?: string;
  /** E-posta da gitsin mi? (varsayılan: evet) */
  email?: boolean;
  /** E-postadaki buton için uygulama içi yol, ör. "/ogrenci/derslerim" */
  ctaPath?: string;
  ctaLabel?: string;
};

// Uygulama içi bildirimi kaydeder, ardından e-posta göndermeyi dener.
// E-posta başarısızlığı iş akışını bozmaz (best-effort); true: yeni bildirim oluştu.
export async function notifyUser(input: NotifyInput): Promise<boolean> {
  let notificationId: string;
  try {
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
    notificationId = created.id;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false; // zaten gönderilmiş
    throw err;
  }

  if (input.email === false) return true;

  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (!user) return true;

    const mail = renderNotificationEmail(input);
    await sendMail({ to: user.email, ...mail });
    await prisma.notification.update({ where: { id: notificationId }, data: { sentAt: new Date() } });
  } catch (err) {
    console.error("bildirim e-postası gönderilemedi", input.type, err);
  }
  return true;
}
