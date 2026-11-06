import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { appUrl, sendMail } from "@/lib/email";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Kullanıcı yoksa da sessizce döner: hesap varlığı dışarıya sızmasın.
export async function createAndSendResetToken(emailRaw: string) {
  const email = emailRaw.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const token = randomBytes(32).toString("hex");

  // Önceki kullanılmamış tokenları geçersiz kıl, yenisini yaz
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${appUrl()}/sifre-sifirla?token=${token}`;
  await sendMail({
    to: email,
    subject: "Penguen Okul şifre sıfırlama",
    text:
      `Şifreni sıfırlamak için aşağıdaki bağlantıyı kullan (1 saat geçerli):\n\n${link}\n\n` +
      `Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
  });
}

async function findValidToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  return record;
}

export async function isResetTokenValid(token: string | undefined) {
  if (!token) return false;
  return (await findValidToken(token)) !== null;
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const record = await findValidToken(token);
  if (!record) return false;

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Aynı kullanıcının diğer bekleyen tokenları da düşsün
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
    }),
  ]);
  return true;
}
