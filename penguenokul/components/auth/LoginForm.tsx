"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "@/lib/actions";
import styles from "./auth.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Giriş yapılıyor…" : "Giriş yap"}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useFormState(loginAction, undefined);

  return (
    <>
      <h1 className={styles.title}>Giriş yap</h1>
      <form action={action} className={styles.form} noValidate>
        {state?.error && (
          <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
            {state.error}
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>E-posta</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>Şifre</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={styles.input} />
        </div>
        {state?.needsTotp && (
          <div className={styles.field}>
            <label htmlFor="totp" className={styles.label}>Doğrulama kodu (6 haneli)</label>
            <input id="totp" name="totp" inputMode="numeric" autoComplete="one-time-code" required className={styles.input} />
          </div>
        )}
        <SubmitButton />
      </form>
      <p className={styles.footer}>
        <Link href="/sifremi-unuttum">Şifremi unuttum</Link> · Hesabın yok mu? <Link href="/kayit">Kayıt ol</Link>
      </p>
    </>
  );
}
