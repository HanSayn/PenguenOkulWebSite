"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createAnnouncementAction, createFaqAction, type ContentState } from "@/lib/content-actions";
import styles from "@/components/ui/panel.module.css";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={styles.button} disabled={pending}>{pending ? "Kaydediliyor…" : label}</button>;
}

export function AnnouncementForm() {
  const [state, action] = useFormState<ContentState, FormData>(createAnnouncementAction, undefined);
  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Duyuru yayınlandı.</p>}
      <input name="title" required maxLength={120} placeholder="Başlık" aria-label="Başlık" className={styles.input} />
      <textarea name="body" required rows={3} maxLength={2000} placeholder="Metin" aria-label="Metin" className={styles.input} style={{ width: "100%", maxWidth: 560 }} />
      <select name="audience" defaultValue="ALL" aria-label="Hedef kitle" className={styles.input} style={{ maxWidth: 240 }}>
        <option value="ALL">Herkes</option>
        <option value="STUDENT">Öğrenciler</option>
        <option value="TEACHER">Öğretmenler</option>
      </select>
      <div><Submit label="Duyuruyu yayınla" /></div>
    </form>
  );
}

export function FaqForm() {
  const [state, action] = useFormState<ContentState, FormData>(createFaqAction, undefined);
  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Soru eklendi.</p>}
      <input name="question" required maxLength={200} placeholder="Soru" aria-label="Soru" className={styles.input} />
      <textarea name="answer" required rows={3} maxLength={2000} placeholder="Cevap" aria-label="Cevap" className={styles.input} style={{ width: "100%", maxWidth: 560 }} />
      <input name="order" type="number" min={0} max={999} defaultValue={0} aria-label="Sıra" className={styles.input} style={{ maxWidth: 120 }} />
      <div><Submit label="Soruyu ekle" /></div>
    </form>
  );
}
