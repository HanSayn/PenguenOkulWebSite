"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { decryptText, encryptText } from "@/lib/crypto";
import { newTotpSecret, verifyTotp } from "@/lib/two-factor";

export type SecurityState = { error?: string; ok?: boolean } | undefined;

// Kurulum: gizli anahtar üretilir ve şifreli saklanır, ama 2FA henüz açık değildir.
export async function startTwoFactorSetupAction(): Promise<void> {
  const { user } = await requireAdmin();
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabled: true } });
  if (current?.twoFactorEnabled) return;

  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: encryptText(newTotpSecret()) } });
  revalidatePath("/admin/guvenlik");
}

export async function enableTwoFactorAction(_prev: SecurityState, formData: FormData): Promise<SecurityState> {
  const { user } = await requireAdmin();
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
  if (!me?.twoFactorSecret) return { error: "Önce kurulumu başlat." };
  if (me.twoFactorEnabled) return { error: "İki adımlı doğrulama zaten açık." };

  const ok = await verifyTotp(decryptText(me.twoFactorSecret), String(formData.get("code") ?? ""));
  if (!ok) return { error: "Kod hatalı ya da süresi dolmuş. Uygulamadaki güncel kodu gir." };

  await prisma.$transaction(async (tx: Tx) => {
    await tx.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await logAudit(tx, { adminId: user.id, action: "admin.2fa.enable", targetType: "User", targetId: user.id });
  });

  revalidatePath("/admin/guvenlik");
  return { ok: true };
}

export async function disableTwoFactorAction(_prev: SecurityState, formData: FormData): Promise<SecurityState> {
  const { user } = await requireAdmin();
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
  if (!me?.twoFactorEnabled || !me.twoFactorSecret) return { error: "İki adımlı doğrulama zaten kapalı." };

  // Kapatmak için de güncel kod istenir; çalınmış bir oturum tek başına 2FA'yı kapatamaz
  const ok = await verifyTotp(decryptText(me.twoFactorSecret), String(formData.get("code") ?? ""));
  if (!ok) return { error: "Kod hatalı. Kapatmak için güncel kodu gir." };

  await prisma.$transaction(async (tx: Tx) => {
    await tx.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    await logAudit(tx, { adminId: user.id, action: "admin.2fa.disable", targetType: "User", targetId: user.id });
  });

  revalidatePath("/admin/guvenlik");
  return { ok: true };
}
