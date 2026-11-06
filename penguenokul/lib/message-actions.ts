"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { getCounterpart, type Viewer } from "@/lib/messaging";

export type SendState = { error?: string; ok?: boolean } | undefined;

const MAX_LENGTH = 1000;
const MAX_PER_MINUTE = 20;

async function resolveViewer(): Promise<Viewer | null> {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;

  if (user.role === "STUDENT") {
    const p = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true, name: true } });
    return p ? { userId: user.id, role: "STUDENT", profileId: p.id, name: p.name } : null;
  }
  if (user.role === "TEACHER") {
    const p = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true, status: true },
    });
    // Askıya alınmış öğretmen yeni mesaj gönderemez
    return p && p.status !== "SUSPENDED" ? { userId: user.id, role: "TEACHER", profileId: p.id, name: p.name } : null;
  }
  return null;
}

export async function sendMessageAction(_prev: SendState, formData: FormData): Promise<SendState> {
  const viewer = await resolveViewer();
  if (!viewer) return { error: "Oturumun sona ermiş. Lütfen yeniden giriş yap." };

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Mesaj boş olamaz." };
  if (content.length > MAX_LENGTH) return { error: `Mesaj en fazla ${MAX_LENGTH} karakter olabilir.` };

  // Yetki: yalnızca ders ilişkisi olan kişiye yazılabilir. Hedef kimliğe form değerinden güvenilmez.
  const other = await getCounterpart(viewer, String(formData.get("to") ?? ""));
  if (!other) return { error: "Bu kişiye mesaj gönderemezsin." };

  const sinceMinute = new Date(Date.now() - 60_000);
  const recent = (await prisma.message.count({
    where: { senderId: viewer.userId, sentAt: { gt: sinceMinute } },
  })) as number;
  if (recent >= MAX_PER_MINUTE) return { error: "Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene." };

  // Karşı taraf önceki mesajlarımı henüz okumadıysa tekrar bildirim/e-posta göndermeyiz
  const alreadyNotified = (await prisma.message.count({
    where: { senderId: viewer.userId, receiverId: other.userId, read: false },
  })) as number;

  const message = (await prisma.message.create({
    data: { senderId: viewer.userId, receiverId: other.userId, content },
    select: { id: true },
  })) as { id: string };

  if (alreadyNotified === 0) {
    const threadPath =
      viewer.role === "TEACHER" ? `/ogrenci/mesajlar/${viewer.profileId}` : `/ogretmen/mesajlar/${viewer.profileId}`;
    await notifyUser({
      userId: other.userId,
      type: "NEW_MESSAGE",
      title: `${viewer.name} sana mesaj gönderdi`,
      body: content.length > 120 ? `${content.slice(0, 117)}…` : content,
      dedupeKey: `msg:${message.id}`,
      ctaPath: threadPath,
      ctaLabel: "Mesajı oku",
    });
  }

  revalidatePath(viewer.role === "TEACHER" ? `/ogretmen/mesajlar/${other.profileId}` : `/ogrenci/mesajlar/${other.profileId}`);
  return { ok: true };
}
