"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { resetPasswordAction } from "@/lib/actions";
import styles from "./auth.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Kaydediliyor…" : "Şifreyi güncelle"}
    </button>
  );
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormState(resetPasswordAction, undefined);

  if (state?.done) {
    return (
      <>
        <h1 className={styles.title}>Şifren güncellendi</h1>
        <p role="status" className={`${styles.alert} ${styles.alertSuccess}`} style={{ marginTop: "var(--space-4)" }}>
          Yeni şifrenle giriş yapabilirsin.
        </p>
        <p className={styles.footer}>
          <Link href="/giris">Giriş yap</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Yeni şifre belirle</h1>
      <form action={action} className={styles.form} noValidate>
        <input type="hidden" name="token" value={token} />
        {state?.error && (
          <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
            {state.error}{" "}
            {state.error.includes("Yeni bir bağlantı") && <Link href="/sifremi-unuttum">Yeni bağlantı iste</Link>}
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>Yeni şifre</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required className={styles.input} />
          <p className={styles.footer} style={{ margin: 0 }}>En az 8 karakter, harf ve rakam içermeli.</p>
        </div>
        <div className={styles.field}>
          <label htmlFor="confirm" className={styles.label}>Yeni şifre (tekrar)</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={styles.input} />
        </div>
        <SubmitButton />
      </form>
    </>
  );
}
