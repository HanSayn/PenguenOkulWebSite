"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export type ContentState = { error?: string; ok?: boolean } | undefined;

const AUDIENCES = ["ALL", "STUDENT", "TEACHER"] as const;
const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function createAnnouncementAction(_prev: ContentState, formData: FormData): Promise<ContentState> {
  const { user } = await requireAdmin();
  const title = clean(formData.get("title"));
  const body = clean(formData.get("body"));
  const audience = clean(formData.get("audience")) || "ALL";

  if (title.length < 3 || title.length > 120) return { error: "Başlık 3-120 karakter olmalı." };
  if (body.length < 5 || body.length > 2000) return { error: "Metin 5-2000 karakter olmalı." };
  if (!(AUDIENCES as readonly string[]).includes(audience)) return { error: "Geçersiz hedef kitle." };

  await prisma.$transaction(async (tx: Tx) => {
    const created = await tx.announcement.create({ data: { title, body, audience } });
    await logAudit(tx, { adminId: user.id, action: "content.announcement.create", targetType: "Announcement", targetId: created.id, after: { audience } });
  });
  revalidatePath("/admin/icerik");
  return { ok: true };
}

export async function toggleAnnouncementAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = clean(formData.get("id"));
  const item = await prisma.announcement.findUnique({ where: { id } });
  if (!item) return;
  await prisma.$transaction(async (tx: Tx) => {
    await tx.announcement.update({ where: { id }, data: { published: !item.published } });
    await logAudit(tx, { adminId: user.id, action: "content.announcement.toggle", targetType: "Announcement", targetId: id, before: { published: item.published }, after: { published: !item.published } });
  });
  revalidatePath("/admin/icerik");
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = clean(formData.get("id"));
  await prisma.$transaction(async (tx: Tx) => {
    const res = await tx.announcement.deleteMany({ where: { id } });
    if (res.count) await logAudit(tx, { adminId: user.id, action: "content.announcement.delete", targetType: "Announcement", targetId: id });
  });
  revalidatePath("/admin/icerik");
}

export async function createFaqAction(_prev: ContentState, formData: FormData): Promise<ContentState> {
  const { user } = await requireAdmin();
  const question = clean(formData.get("question"));
  const answer = clean(formData.get("answer"));
  const order = Number(formData.get("order") ?? 0);

  if (question.length < 5 || question.length > 200) return { error: "Soru 5-200 karakter olmalı." };
  if (answer.length < 5 || answer.length > 2000) return { error: "Cevap 5-2000 karakter olmalı." };
  if (!Number.isInteger(order) || order < 0 || order > 999) return { error: "Sıra 0-999 arasında bir tam sayı olmalı." };

  await prisma.$transaction(async (tx: Tx) => {
    const created = await tx.faqItem.create({ data: { question, answer, order } });
    await logAudit(tx, { adminId: user.id, action: "content.faq.create", targetType: "FaqItem", targetId: created.id });
  });
  revalidatePath("/admin/icerik");
  revalidatePath("/sss");
  return { ok: true };
}

export async function toggleFaqAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = clean(formData.get("id"));
  const item = await prisma.faqItem.findUnique({ where: { id } });
  if (!item) return;
  await prisma.$transaction(async (tx: Tx) => {
    await tx.faqItem.update({ where: { id }, data: { published: !item.published } });
    await logAudit(tx, { adminId: user.id, action: "content.faq.toggle", targetType: "FaqItem", targetId: id, before: { published: item.published }, after: { published: !item.published } });
  });
  revalidatePath("/admin/icerik");
  revalidatePath("/sss");
}

export async function deleteFaqAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = clean(formData.get("id"));
  await prisma.$transaction(async (tx: Tx) => {
    const res = await tx.faqItem.deleteMany({ where: { id } });
    if (res.count) await logAudit(tx, { adminId: user.id, action: "content.faq.delete", targetType: "FaqItem", targetId: id });
  });
  revalidatePath("/admin/icerik");
  revalidatePath("/sss");
}
