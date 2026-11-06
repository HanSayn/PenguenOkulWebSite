import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return NextResponse.json({ error: "Form hatalı.", fieldErrors }, { status: 422 });
  }

  const { role, name, email, password, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta ile zaten bir hesap var.", fieldErrors: { email: "Bu e-posta kayıtlı." } },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        ...(role === "STUDENT"
          ? { student: { create: { name, phone } } }
          : // Öğretmenler admin onayına kadar PENDING kalır (şema varsayılanı)
            { teacher: { create: { name } } }),
      },
    });
  } catch (err) {
    // Eşzamanlı iki kayıt aynı e-postayı denerse unique ihlali
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta ile zaten bir hesap var." }, { status: 409 });
    }
    console.error("kayit hatası", err);
    return NextResponse.json({ error: "Kayıt sırasında bir sorun oluştu." }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        role === "TEACHER"
          ? "Başvurun alındı. Hesabın admin onayından sonra aktif olacak."
          : "Kayıt tamamlandı. Şimdi giriş yapabilirsin.",
    },
    { status: 201 }
  );
}
