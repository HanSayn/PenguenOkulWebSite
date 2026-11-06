import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Sayfa ve action'larda öğrenci yetkisini doğrular (middleware'e ek, derinlemesine savunma).
export async function requireStudent() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") redirect("/giris");

  const student = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!student) redirect("/giris");

  return { user: session.user, student };
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/giris");
  return { user: session.user };
}

export async function requireTeacher() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") redirect("/giris");

  const teacher = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
  // Askıya alınmış öğretmen oturumu açık kalmış olsa bile panele giremez
  if (!teacher || teacher.status === "SUSPENDED") redirect("/giris");

  return { user: session.user, teacher };
}
