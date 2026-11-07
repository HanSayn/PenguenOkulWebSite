"use client";

import { useFormState, useFormStatus } from "react-dom";
import { deleteAccountAction, type DeleteState } from "@/lib/account-actions";
import styles from "@/components/ui/panel.module.css";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending} style={{ background: "var(--danger, #b3261e)" }}>
      {pending ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
    </button>
  );
}

// KVKK: verini indir ve hesabını sil. Hem öğrenci hem öğretmen profil sayfasında kullanılır.
export default function DataPanel() {
  const [state, action] = useFormState<DeleteState, FormData>(deleteAccountAction, undefined);

  return (
    <section className={styles.section} aria-labelledby="veri-baslik">
      <h2 id="veri-baslik" className={styles.sectionTitle}>Verilerim ve hesabım</h2>
      <div className={styles.panel}>
        <p>Penguen Okul&apos;da tutulan verilerinin bir kopyasını JSON dosyası olarak indirebilirsin.</p>
        <p>
          <a href="/api/hesabim/disa-aktar" className={styles.buttonSecondary} download>Verilerimi indir</a>
        </p>
      </div>

      <details className={styles.panel} style={{ marginTop: "var(--space-4)" }}>
        <summary style={{ fontWeight: 600, cursor: "pointer" }}>Hesabımı sil</summary>
        <p style={{ margin: "var(--space-3) 0" }}>
          Adın, iletişim bilgilerin, mesajların ve destek kayıtların silinir; hesabına bir daha girilemez. Kalan ders hakların kaybolur.
          Ödeme ve hak ediş kayıtları yasal saklama süresi boyunca kimliksiz biçimde tutulur. Bu işlem geri alınamaz.
        </p>
        <form action={action} className={styles.actionsStack}>
          <label htmlFor="del-password">Şifren</label>
          <input id="del-password" name="password" type="password" autoComplete="current-password" required />
          <label htmlFor="del-confirm">Onaylamak için SİL yaz</label>
          <input id="del-confirm" name="confirm" type="text" autoComplete="off" required />
          {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
          <DeleteButton />
        </form>
      </details>
    </section>
  );
}
