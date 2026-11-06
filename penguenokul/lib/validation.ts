import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(72, "Şifre en fazla 72 karakter olabilir") // bcrypt sınırı
  .regex(/[A-Za-z]/, "Şifre en az bir harf içermeli")
  .regex(/\d/, "Şifre en az bir rakam içermeli");

// Hem kayıt formu (client) hem /api/kayit (server) bu şemayı kullanır.
export const registerSchema = z.object({
  role: z.enum(["STUDENT", "TEACHER"]),
  name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı").max(80),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta gir"),
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\s()-]{10,20}$/, "Geçerli bir telefon numarası gir")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type RegisterInput = z.infer<typeof registerSchema>;
