import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma, type Tx } from "@/lib/prisma";

// KVKK: kullanıcının kendi verisini dışa aktarma ve hesabı silme (anonimleştirme).
// Şifre özeti, 2FA anahtarı, başkalarının özel notları ve iç yönetim kayıtları dışa aktarmaya girmez.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const omit = (o: object, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

export async function buildExport(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      twoFactorEnabled: true,
      student: true,
      teacher: { include: { subjects: { include: { subject: { select: { name: true } } } }, availability: true } },
    },
  });
  if (!user) return null;

  const [messages, notifications, tickets] = await Promise.all([
    prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { sentAt: "asc" },
      select: { senderId: true, receiverId: true, content: true, sentAt: true, read: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { type: true, title: true, body: true, isRead: true, createdAt: true },
    }),
    prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { subject: true, status: true, createdAt: true, messages: { select: { authorId: true, content: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, role: user.role, createdAt: iso(user.createdAt), twoFactorEnabled: user.twoFactorEnabled },
    messages: messages.map((m) => ({ ...m, direction: m.senderId === userId ? "gönderilen" : "alınan", senderId: undefined, receiverId: undefined })),
    notifications,
    supportTickets: tickets,
  };

  if (user.student) {
    const sid = user.student.id;
    const [lessons, purchases, payments, homework, reviews] = await Promise.all([
      prisma.lesson.findMany({
        where: { studentId: sid },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true, durationMin: true, status: true, isTrial: true, notes: true, teacher: { select: { name: true } }, topic: { select: { name: true } } },
      }),
      prisma.purchase.findMany({ where: { studentId: sid }, select: { purchasedAt: true, remainingLessons: true, expiresAt: true, unitPrice: true, package: { select: { name: true } } } }),
      prisma.payment.findMany({
        where: { studentId: sid },
        orderBy: { createdAt: "asc" },
        select: { amount: true, status: true, provider: true, paidAt: true, createdAt: true, package: { select: { name: true } }, invoice: { select: { invoiceNumber: true, issuedAt: true, description: true } } },
      }),
      prisma.homework.findMany({ where: { studentId: sid }, select: { title: true, description: true, dueAt: true, completedAt: true, teacher: { select: { name: true } } } }),
      prisma.review.findMany({ where: { studentId: sid }, select: { rating: true, comment: true, createdAt: true, teacher: { select: { name: true } } } }),
    ]);
    out.studentProfile = omit(user.student, ["id", "userId"]);
    out.lessons = lessons;
    out.purchases = purchases;
    out.payments = payments;
    out.homework = homework;
    out.reviewsWritten = reviews;
  }

  if (user.teacher) {
    const tid = user.teacher.id;
    const [lessons, earnings, payouts, reviews, homework] = await Promise.all([
      prisma.lesson.findMany({
        where: { teacherId: tid },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true, durationMin: true, status: true, isTrial: true, student: { select: { name: true } } },
      }),
      prisma.lessonEarning.findMany({ where: { teacherId: tid }, select: { gross: true, commissionRate: true, commission: true, net: true, payoutId: true, createdAt: true } }),
      prisma.payout.findMany({ where: { teacherId: tid }, select: { amount: true, note: true, createdAt: true } }),
      prisma.review.findMany({ where: { teacherId: tid }, select: { rating: true, comment: true, createdAt: true } }),
      prisma.homework.findMany({ where: { teacherId: tid }, select: { title: true, description: true, dueAt: true, completedAt: true, student: { select: { name: true } } } }),
    ]);
    out.teacherProfile = {
      ...omit(user.teacher, ["id", "userId", "subjects", "availability"]),
      subjects: user.teacher.subjects.map((s: { subject: { name: string } }) => s.subject.name),
      availability: user.teacher.availability,
    };
    out.lessons = lessons;
    out.earnings = earnings;
    out.payouts = payouts;
    out.reviewsReceived = reviews;
    out.homeworkGiven = homework;
  }

  return out;
}

export type DeleteBlock = { code: "active-lessons" | "unpaid-earnings" | "admin"; message: string };

// Silmeyi engelleyen açık işler: bekleyen/onaylı dersler ve öğretmenin ödenmemiş hak edişi.
export async function deletionBlocker(userId: string): Promise<DeleteBlock | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, student: true, teacher: true } });
  if (!user) return null;
  if (user.role === "ADMIN") {
    return { code: "admin", message: "Yönetici hesabı buradan silinemez. Başka bir yöneticiyle iletişime geç." };
  }
  const open = await prisma.lesson.count({
    where: {
      status: { in: ["REQUESTED", "CONFIRMED"] },
      ...(user.student ? { studentId: user.student.id } : { teacherId: user.teacher?.id ?? "-" }),
    },
  });
  if (open > 0) {
    return { code: "active-lessons", message: `${open} bekleyen veya onaylı dersin var. Önce bunları iptal et ya da tamamlanmasını bekle.` };
  }
  if (user.teacher) {
    const unpaid = await prisma.lessonEarning.count({ where: { teacherId: user.teacher.id, payoutId: null } });
    if (unpaid > 0) {
      return { code: "unpaid-earnings", message: "Ödenmemiş hak edişin var. Ödemen tamamlandıktan sonra hesabı silebilirsin." };
    }
  }
  return null;
}

const PHOTO_DIR = path.join(process.cwd(), "public", "uploads", "teachers");

// Hesabı anonimleştirir. Mali kayıtlar (ödeme, belge, hak ediş) yasal saklama için kalır; kişiyi tanıtan her şey silinir.
export async function anonymizeUser(userId: string): Promise<boolean> {
  let photo: string | null = null;

  const done = await prisma.$transaction(async (tx: Tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true, student: { select: { id: true } }, teacher: { select: { id: true, photo: true } } } });
    if (!user || user.deletedAt) return false;

    await tx.user.update({
      where: { id: userId },
      data: {
        email: `silindi-${userId}@deleted.invalid`,
        passwordHash: "!", // hiçbir şifre eşleşmez
        twoFactorSecret: null,
        twoFactorEnabled: false,
        deletedAt: new Date(),
      },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.supportTicket.deleteMany({ where: { userId } }); // mesajları zincirleme silinir
    await tx.supportMessage.deleteMany({ where: { authorId: userId } });
    await tx.message.updateMany({ where: { senderId: userId }, data: { content: "[Mesaj silindi]" } });

    if (user.student) {
      const sid = user.student.id;
      await tx.studentProfile.update({
        where: { id: sid },
        data: { name: "Silinmiş öğrenci", phone: null, grade: null, targetExam: null, parentName: null, parentPhone: null, smsConsent: false },
      });
      await tx.teacherNote.deleteMany({ where: { studentId: sid } });
      await tx.homework.deleteMany({ where: { studentId: sid } });
      await tx.review.updateMany({ where: { studentId: sid }, data: { comment: null } });
      await tx.lesson.updateMany({ where: { studentId: sid }, data: { notes: null } });
      // Kullanılmamış hak kalmasın
      await tx.purchase.updateMany({ where: { studentId: sid }, data: { remainingLessons: 0 } });
    }

    if (user.teacher) {
      const tid = user.teacher.id;
      photo = user.teacher.photo;
      await tx.teacherProfile.update({
        where: { id: tid },
        data: { name: "Silinmiş öğretmen", bio: null, photo: null, osymScore: null, status: "SUSPENDED" }, // listelerde görünmez
      });
      await tx.availability.deleteMany({ where: { teacherId: tid } });
      await tx.teacherSubject.deleteMany({ where: { teacherId: tid } });
      await tx.teacherNote.deleteMany({ where: { teacherId: tid } });
      await tx.homework.deleteMany({ where: { teacherId: tid } });
    }
    return true;
  });

  if (done && photo) await unlink(path.join(PHOTO_DIR, path.basename(photo))).catch(() => {});
  return done;
}
