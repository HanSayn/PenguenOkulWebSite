import type { Metadata } from "next";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function KayitPage({
  searchParams,
}: {
  searchParams: { rol?: string };
}) {
  // Landing page'deki bağlantılar ?rol=ogrenci | ogretmen gönderir
  const defaultRole = searchParams.rol === "ogretmen" ? "TEACHER" : "STUDENT";
  return <RegisterForm defaultRole={defaultRole} />;
}
