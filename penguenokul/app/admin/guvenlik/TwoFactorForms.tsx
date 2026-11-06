"use client";

import { useFormState, useFormStatus } from "react-dom";
import { enableTwoFactorAction, disableTwoFactorAction } from "@/lib/security-actions";
import styles from "@/components/ui/panel.module.css";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Kontrol ediliyor…" : label}
    </button>
  );
}

const codeInput = (
  <input
    name="code"
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="[0-9 ]{6,7}"
    required
    placeholder="6 haneli kod"
    className={styles.input}
    style={{ maxWidth: 200, letterSpacing: "0.2em" }}
  />
);

export function EnableForm() {
  const [state, action] = useFormState(enableTwoFactorAction, undefined);
  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      <label className={styles.label}>Uygulamadaki kodu gir</label>
      {codeInput}
      <div><Submit label="Doğrula ve aç" /></div>
    </form>
  );
}

export function DisableForm() {
  const [state, action] = useFormState(disableTwoFactorAction, undefined);
  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      <label className={styles.label}>Kapatmak için güncel kodu gir</label>
      {codeInput}
      <div><Submit label="İki adımlı doğrulamayı kapat" /></div>
    </form>
  );
}
