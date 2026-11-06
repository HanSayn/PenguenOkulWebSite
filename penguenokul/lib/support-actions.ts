"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma, type Tx } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

export type SupportState = { error?: string; ok?: boolean } | undefined;
const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function currentUser() {
  const session = await auth();
  if (!session?.user) redirect("/giris");
  return { id: session.user.id as string, role: session.user.role as string };
}

const areaFor = (role: string) => (role === "TEACHER" ? "ogretmen" : role === "STUDENT" ? "ogrenci" : "admin");

// Öğrenci ve öğretmen yeni talep açar; ilk mesaj talebin içinde saklanır.
export async function createTicketAction(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const me = await currentUser();
  if (me.role !== "STUDENT" && me.role !== "TEACHER") return { error: "Bu işlem için yetkin yok." };

  const subject = clean(formData.get("subject"));
  const message = clean(formData.get("message"));
  if (subject.length < 3 || subject.length > 120) return { error: "Konu 3-120 karakter olmalı." };
  if (message.length < 10 || message.length > 2000) return { error: "Mesaj 10-2000 karakter olmalı." };

  const ticket = await prisma.$transaction(async (tx: Tx) => {
    const t = await tx.supportTicket.create({ data: { userId: me.id, subject } });
    await tx.supportMessage.create({ data: { ticketId: t.id, authorId: me.id, content: message } });
    return t;
  });

  revalidatePath(`/${areaFor(me.role)}/destek`);
  redirect(`/${areaFor(me.role)}/destek/${ticket.id}`);
}

// Talep sahibi ya da yönetici yanıtlayabilir. Kapalı talebe sahip yanıt yazamaz.
export async function replyTicketAction(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const me = await currentUser();
  const ticketId = clean(formData.get("ticketId"));
  const content = clean(formData.get("content"));
  if (content.length < 2 || content.length > 2000) return { error: "Mesaj 2-2000 karakter olmalı." };

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  const isAdmin = me.role === "ADMIN";
  if (!ticket || (!isAdmin && ticket.userId !== me.id)) return { error: "Talep bulunamadı." };
  if (ticket.status === "CLOSED") return { error: "Bu talep kapatılmış." };

  await prisma.$transaction(async (tx: Tx) => {
    await tx.supportMessage.create({ data: { ticketId, authorId: me.id, content } });
    if (isAdmin && ticket.status === "OPEN") {
      await tx.supportTicket.update({ where: { id: ticketId }, data: { status: "IN_PROGRESS" } });
    }
  });

  if (isAdmin) {
    const owner = await prisma.user.findUnique({ where: { id: ticket.userId }, select: { role: true } });
    await notifyUser({
      userId: ticket.userId,
      type: "SUPPORT_REPLY",
      title: "Destek talebine yanıt geldi",
      body: ticket.subject,
      email: false,
      ctaPath: owner?.role === "TEACHER" ? `/ogretmen/destek/${ticketId}` : `/ogrenci/destek/${ticketId}`,
      ctaLabel: "Talebi görüntüle",
    });
  }

  revalidatePath(`/${areaFor(me.role)}/destek/${ticketId}`);
  revalidatePath(`/${areaFor(me.role)}/destek`);
  return { ok: true };
}

export async function setTicketStatusAction(formData: FormData): Promise<void> {
  const me = await currentUser();
  if (me.role !== "ADMIN") redirect("/giris");
  const ticketId = clean(formData.get("ticketId"));
  const status = clean(formData.get("status"));
  if (!["OPEN", "IN_PROGRESS", "CLOSED"].includes(status)) redirect(`/admin/destek/${ticketId}?hata=durum`);

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) redirect("/admin/destek?hata=bulunamadi");

  await prisma.$transaction(async (tx: Tx) => {
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: status as "OPEN" | "IN_PROGRESS" | "CLOSED" } });
    await logAudit(tx, { adminId: me.id, action: "support.status", targetType: "SupportTicket", targetId: ticketId, before: { status: ticket.status }, after: { status } });
  });
  revalidatePath(`/admin/destek/${ticketId}`);
  revalidatePath("/admin/destek");
}
