"use client";

import Link from "next/link";
import { useState } from "react";
import { registerSchema } from "@/lib/validation";
import styles from "./auth.module.css";

type Role = "STUDENT" | "TEACHER";
type FieldErrors = Partial<Record<"name" | "email" | "password" | "phone", string>>;

export default function RegisterForm({ defaultRole }: { defaultRole: Role }) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);

    const fd = new FormData(e.currentTarget);
    const input = {
      role,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      phone: String(fd.get("phone") ?? ""),
    };

    // Aynı şema sunucuda da çalışır; burada yalnızca hızlı geri bildirim için.
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    setPending(true);
    try {
      const res = await fetch("/api/kayit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? "Kayıt başarısız.");
        return;
      }
      setSuccess(data.message);
    } catch {
      setFormError("Sunucuya ulaşılamadı. Biraz sonra tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <>
        <h1 className={styles.title}>Kayıt tamamlandı</h1>
        <p role="status" className={`${styles.alert} ${styles.alertSuccess}`} style={{ marginTop: "var(--space-4)" }}>
          {success}
        </p>
        <p className={styles.footer}>
          <Link href="/giris">Giriş sayfasına git</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Ücretsiz kayıt</h1>
      <form onSubmit={onSubmit} className={styles.form} noValidate>
        {formError && (
          <p role="alert" className={`${styles.alert} ${styles.alertError}`}>{formError}</p>
        )}

        <fieldset className={styles.roles}>
          <legend className="visually-hidden">Hesap türü</legend>
          <label className={styles.roleOption}>
            <input type="radio" name="role" value="STUDENT" checked={role === "STUDENT"} onChange={() => setRole("STUDENT")} />
            Öğrenciyim
          </label>
          <label className={styles.roleOption}>
            <input type="radio" name="role" value="TEACHER" checked={role === "TEACHER"} onChange={() => setRole("TEACHER")} />
            Öğretmenim
          </label>
        </fieldset>

        <Field id="name" label="Ad soyad" autoComplete="name" error={errors.name} />
        <Field id="email" label="E-posta" type="email" autoComplete="email" error={errors.email} />
        <Field id="phone" label="Telefon (isteğe bağlı)" type="tel" autoComplete="tel" error={errors.phone} />
        <Field id="password" label="Şifre" type="password" autoComplete="new-password" error={errors.password} hint="En az 8 karakter, harf ve rakam içermeli." />

        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Kaydediliyor…" : role === "TEACHER" ? "Başvuru gönder" : "Kayıt ol"}
        </button>
      </form>
      <p className={styles.footer}>
        Zaten hesabın var mı? <Link href="/giris">Giriş yap</Link>
      </p>
    </>
  );
}

function Field({
  id, label, type = "text", autoComplete, error, hint,
}: {
  id: string; label: string; type?: string; autoComplete?: string; error?: string; hint?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p id={`${id}-error`} className={styles.error}>{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.footer} style={{ margin: 0 }}>{hint}</p>
      ) : null}
    </div>
  );
}
