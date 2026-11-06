import type { Metadata } from "next";
import Link from "next/link";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { isResetTokenValid } from "@/lib/password-reset";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = { title: "Şifre sıfırla" };

// Token her istekte veritabanından doğrulanır, önbelleğe alınmamalı.
export const dynamic = "force-dynamic";

export default async function SifreSifirlaPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  if (!token || !(await isResetTokenValid(token))) {
    return (
      <>
        <h1 className={styles.title}>Bağlantı geçersiz</h1>
        <p role="alert" className={`${styles.alert} ${styles.alertError}`} style={{ marginTop: "var(--space-4)" }}>
          Bu şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş.
        </p>
        <p className={styles.footer}>
          <Link href="/sifremi-unuttum">Yeni bağlantı iste</Link>
        </p>
      </>
    );
  }

  return <ResetPasswordForm token={token} />;
}
