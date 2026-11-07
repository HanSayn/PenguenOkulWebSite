"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { roleHome, type AppRole } from "@/auth.config";
import { passwordSchema } from "@/lib/validation";
import { createAndSendResetToken, resetPasswordWithToken } from "@/lib/password-reset";
import { clientIp, rateLimit, resetRateLimit, waitText } from "@/lib/rate-limit";

export type LoginState = { error?: string; needsTotp?: boolean } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "").trim();

  if (!email || !password) return { error: "E-posta ve şifre gerekli." };

  // Kaba kuvvet koruması: hesap başına 8, adres başına 30 deneme / 15 dk. Başarılı girişte hesap sayacı sıfırlanır.
  const emailKey = `login:email:${email.slice(0, 200)}`;
  const byEmail = await rateLimit(emailKey, 8, 15 * 60);
  const byIp = await rateLimit(`login:ip:${clientIp()}`, 30, 15 * 60);
  if (!byEmail.ok || !byIp.ok) {
    const wait = Math.max(byEmail.retryAfterSec, byIp.retryAfterSec);
    return { error: `Çok fazla deneme yaptın. ${waitText(wait)} sonra tekrar dene.` };
  }

  try {
    await signIn("credentials", { email, password, totp, redirect: false });
    await resetRateLimit(emailKey);
  } catch (err) {
    if (err instanceof AuthError) {
      // Şifre doğruysa ve 2FA açıksa kod alanını göster (şifre yanlışken hesabın 2FA'lı olduğu sızdırılmaz)
      if (!totp) {
        const candidate = await prisma.user.findUnique({
          where: { email },
          select: { passwordHash: true, twoFactorEnabled: true },
        });
        if (candidate?.twoFactorEnabled && (await bcrypt.compare(password, candidate.passwordHash))) {
          return { needsTotp: true, error: "Doğrulama kodunu gir." };
        }
      }
      return { error: totp ? "E-posta, şifre veya doğrulama kodu hatalı." : "E-posta veya şifre hatalı." };
    }
    throw err;
  }

  // Rolü bulup ilgili panele yönlendir
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  redirect(user ? roleHome[user.role as AppRole] : "/");
}

export type ResetRequestState = { error?: string; sent?: boolean } | undefined;

export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success) {
    return { error: "Geçerli bir e-posta gir." };
  }

  const limited = await rateLimit(`reset:email:${email.toLowerCase().slice(0, 200)}`, 3, 60 * 60);
  const limitedIp = await rateLimit(`reset:ip:${clientIp()}`, 15, 60 * 60);
  if (!limited.ok || !limitedIp.ok) {
    return { error: `Çok fazla istek gönderdin. ${waitText(Math.max(limited.retryAfterSec, limitedIp.retryAfterSec))} sonra tekrar dene.` };
  }

  try {
    await createAndSendResetToken(email);
  } catch (err) {
    console.error("şifre sıfırlama e-postası gönderilemedi", err);
    return { error: "E-posta gönderilemedi. Biraz sonra tekrar dene." };
  }

  // Hesap var ya da yok, aynı cevap verilir.
  return { sent: true };
}

export type ResetPasswordState = { error?: string; done?: boolean } | undefined;

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "Şifreler eşleşmiyor." };

  const ok = await resetPasswordWithToken(token, password);
  if (!ok) return { error: "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste." };

  return { done: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/giris" });
}
