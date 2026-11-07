"use server";

import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { anonymizeUser, deletionBlocker } from "@/lib/account-data";
import { rateLimit, waitText } from "@/lib/rate-limit";

export type DeleteState = { error?: string } | undefined;

// Hesap silme: şifre + "SİL" yazılması ister, açık ders/hak ediş varken reddeder.
export async function deleteAccountAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const session = await auth();
  if (!session?.user) return { error: "Oturumun sona ermiş. Yeniden giriş yap." };
  const userId = session.user.id;

  const limited = await rateLimit(`delete-account:${userId}`, 5, 60 * 60);
  if (!limited.ok) return { error: `Çok fazla deneme. ${waitText(limited.retryAfterSec)} sonra tekrar dene.` };

  const confirm = String(formData.get("confirm") ?? "").trim().toLocaleUpperCase("tr-TR");
  if (confirm !== "SİL") return { error: "Onaylamak için kutuya SİL yaz." };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  const password = String(formData.get("password") ?? "");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Şifre hatalı." };

  const block = await deletionBlocker(userId);
  if (block) return { error: block.message };

  const ok = await anonymizeUser(userId);
  if (!ok) return { error: "Hesap silinemedi. Destek ile iletişime geç." };

  await signOut({ redirectTo: "/?hesap=silindi" });
  return undefined;
}
