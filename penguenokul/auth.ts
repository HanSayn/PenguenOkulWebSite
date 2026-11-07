import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { decryptText } from "@/lib/crypto";
import { verifyTotp } from "@/lib/two-factor";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
        totp: { label: "Doğrulama kodu", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          include: { teacher: { select: { status: true } } },
        });
        if (!user || user.deletedAt) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // İki adımlı doğrulama açıksa şifreye ek olarak güncel kod gerekir
        if (user.twoFactorEnabled) {
          if (!user.twoFactorSecret) return null;
          const codeOk = await verifyTotp(decryptText(user.twoFactorSecret), parsed.data.totp ?? "");
          if (!codeOk) return null;
        }

        // Askıya alınmış öğretmen giriş yapamaz. PENDING olanlar profilini tamamlamak için girebilir.
        if (user.teacher?.status === "SUSPENDED") return null;

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
});
