"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { requestResetAction } from "@/lib/actions";
import styles from "./auth.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Gönderiliyor…" : "Bağlantı gönder"}
    </button>
  );
}

export default function ForgotPasswordForm() {
  const [state, action] = useFormState(requestResetAction, undefined);

  if (state?.sent) {
    return (
      <>
        <h1 className={styles.title}>E-postanı kontrol et</h1>
        <p role="status" className={`${styles.alert} ${styles.alertSuccess}`} style={{ marginTop: "var(--space-4)" }}>
          Bu e-posta ile kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi. Bağlantı 1 saat geçerli.
        </p>
        <p className={styles.footer}>
          <Link href="/giris">Girişe dön</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Şifremi unuttum</h1>
      <p className={styles.footer}>E-posta adresini gir, sana sıfırlama bağlantısı gönderelim.</p>
      <form action={action} className={styles.form} noValidate>
        {state?.error && (
          <p role="alert" className={`${styles.alert} ${styles.alertError}`}>{state.error}</p>
        )}
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>E-posta</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={styles.input} />
        </div>
        <SubmitButton />
      </form>
      <p className={styles.footer}>
        <Link href="/giris">Girişe dön</Link>
      </p>
    </>
  );
}
