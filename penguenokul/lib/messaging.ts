import { prisma } from "@/lib/prisma";
import { MESSAGE_STATUSES, hasLessonBetween } from "@/lib/relations";

// Mesajlaşma yalnızca aralarında (talep, onaylı ya da yapılmış) bir ders ilişkisi olan öğrenci ve öğretmen arasındadır.
// URL'lerde kullanıcı kimliği değil profil kimliği kullanılır: öğretmen tarafında öğrenci profili, öğrenci tarafında öğretmen profili.

export type Viewer = {
  userId: string;
  role: "STUDENT" | "TEACHER";
  profileId: string;
  name: string;
};

export type Counterpart = { profileId: string; userId: string; name: string };

export type ConversationSummary = Counterpart & {
  lastContent: string | null;
  lastAt: Date | null;
  lastFromMe: boolean;
  unread: number;
};

export type ThreadMessage = { id: string; senderId: string; content: string; sentAt: Date };

async function listCounterparts(viewer: Viewer): Promise<Counterpart[]> {
  if (viewer.role === "TEACHER") {
    const rows = (await prisma.lesson.findMany({
      where: { teacherId: viewer.profileId, status: { in: MESSAGE_STATUSES } },
      select: { student: { select: { id: true, name: true, userId: true } } },
      distinct: ["studentId"],
    })) as { student: { id: string; name: string; userId: string } }[];
    return rows.map((r) => ({ profileId: r.student.id, userId: r.student.userId, name: r.student.name }));
  }

  const rows = (await prisma.lesson.findMany({
    where: { studentId: viewer.profileId, status: { in: MESSAGE_STATUSES } },
    select: { teacher: { select: { id: true, name: true, userId: true } } },
    distinct: ["teacherId"],
  })) as { teacher: { id: string; name: string; userId: string } }[];
  return rows.map((r) => ({ profileId: r.teacher.id, userId: r.teacher.userId, name: r.teacher.name }));
}

// Karşı tarafı bulur ve aralarında mesajlaşma hakkı olup olmadığını doğrular; yoksa null.
export async function getCounterpart(viewer: Viewer, otherProfileId: string): Promise<Counterpart | null> {
  if (viewer.role === "TEACHER") {
    const student = (await prisma.studentProfile.findUnique({
      where: { id: otherProfileId },
      select: { id: true, name: true, userId: true },
    })) as { id: string; name: string; userId: string } | null;
    if (!student) return null;
    if (!(await hasLessonBetween(viewer.profileId, student.id, MESSAGE_STATUSES))) return null;
    return { profileId: student.id, userId: student.userId, name: student.name };
  }

  const teacher = (await prisma.teacherProfile.findUnique({
    where: { id: otherProfileId },
    select: { id: true, name: true, userId: true },
  })) as { id: string; name: string; userId: string } | null;
  if (!teacher) return null;
  if (!(await hasLessonBetween(teacher.id, viewer.profileId, MESSAGE_STATUSES))) return null;
  return { profileId: teacher.id, userId: teacher.userId, name: teacher.name };
}

export async function listConversations(viewer: Viewer): Promise<ConversationSummary[]> {
  const counterparts = await listCounterparts(viewer);
  if (counterparts.length === 0) return [];

  const ids = counterparts.map((c) => c.userId);
  const [recent, unreadRows] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          { senderId: viewer.userId, receiverId: { in: ids } },
          { receiverId: viewer.userId, senderId: { in: ids } },
        ],
      },
      orderBy: { sentAt: "desc" },
      take: 500,
      select: { senderId: true, receiverId: true, content: true, sentAt: true },
    }) as Promise<{ senderId: string; receiverId: string; content: string; sentAt: Date }[]>,
    prisma.message.findMany({
      where: { receiverId: viewer.userId, read: false, senderId: { in: ids } },
      select: { senderId: true },
    }) as Promise<{ senderId: string }[]>,
  ]);

  // recent yeniden eskiye sıralı: bir kişi için ilk görülen mesaj sonuncusudur
  const last = new Map<string, { content: string; sentAt: Date; fromMe: boolean }>();
  for (const m of recent) {
    const other = m.senderId === viewer.userId ? m.receiverId : m.senderId;
    if (!last.has(other)) last.set(other, { content: m.content, sentAt: m.sentAt, fromMe: m.senderId === viewer.userId });
  }

  const unread = new Map<string, number>();
  for (const r of unreadRows) unread.set(r.senderId, (unread.get(r.senderId) ?? 0) + 1);

  return counterparts
    .map((c) => {
      const l = last.get(c.userId);
      return {
        ...c,
        lastContent: l?.content ?? null,
        lastAt: l?.sentAt ?? null,
        lastFromMe: l?.fromMe ?? false,
        unread: unread.get(c.userId) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.lastAt && b.lastAt) return b.lastAt.getTime() - a.lastAt.getTime();
      if (a.lastAt) return -1;
      if (b.lastAt) return 1;
      return a.name.localeCompare(b.name, "tr");
    });
}

// Konuşmayı eskiden yeniye döndürür (son 100 mesaj) ve karşı tarafın mesajlarını okundu yapar.
export async function loadThread(viewer: Viewer, other: Counterpart): Promise<ThreadMessage[]> {
  const messages = (await prisma.message.findMany({
    where: {
      OR: [
        { senderId: viewer.userId, receiverId: other.userId },
        { senderId: other.userId, receiverId: viewer.userId },
      ],
    },
    orderBy: { sentAt: "desc" },
    take: 100,
    select: { id: true, senderId: true, content: true, sentAt: true },
  })) as ThreadMessage[];

  await prisma.message.updateMany({
    where: { senderId: other.userId, receiverId: viewer.userId, read: false },
    data: { read: true },
  });

  // Okunmamış mesaj kalmadıysa, mesaj bildirimleri de okunmuş sayılır
  const left = (await prisma.message.count({ where: { receiverId: viewer.userId, read: false } })) as number;
  if (left === 0) {
    await prisma.notification.updateMany({
      where: { userId: viewer.userId, type: "NEW_MESSAGE", isRead: false },
      data: { isRead: true },
    });
  }

  return messages.reverse();
}

export async function countUnreadMessages(userId: string): Promise<number> {
  return (await prisma.message.count({ where: { receiverId: userId, read: false } })) as number;
}
