"use client";

import { useFormState, useFormStatus } from "react-dom";
import { savePackageAction, type PackageState } from "@/lib/package-actions";
import styles from "@/components/ui/panel.module.css";

type Props = { id?: string; name?: string; lessonCount?: number; durationMonths?: number; priceTL?: string; submitLabel: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={styles.button} disabled={pending}>{pending ? "Kaydediliyor…" : label}</button>;
}

export default function PackageForm({ id, name = "", lessonCount = 8, durationMonths = 1, priceTL = "", submitLabel }: Props) {
  const [state, action] = useFormState<PackageState, FormData>(savePackageAction, undefined);
  const key = id ?? "new";
  return (
    <form action={action} className={styles.inlineForm} style={{ flexWrap: "wrap", alignItems: "end" }}>
      {id && <input type="hidden" name="id" value={id} />}
      <div className={styles.field}>
        <label htmlFor={`name-${key}`} className={styles.label}>Ad</label>
        <input id={`name-${key}`} name="name" defaultValue={name} required maxLength={60} className={styles.input} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`count-${key}`} className={styles.label}>Ders</label>
        <input id={`count-${key}`} name="lessonCount" type="number" min={1} max={200} defaultValue={lessonCount} required className={styles.input} style={{ width: 84 }} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`months-${key}`} className={styles.label}>Ay</label>
        <input id={`months-${key}`} name="durationMonths" type="number" min={1} max={24} defaultValue={durationMonths} required className={styles.input} style={{ width: 84 }} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`price-${key}`} className={styles.label}>Fiyat (TL)</label>
        <input id={`price-${key}`} name="price" defaultValue={priceTL} required inputMode="decimal" placeholder="2400" className={styles.input} style={{ width: 120 }} />
      </div>
      <Submit label={submitLabel} />
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`} style={{ flexBasis: "100%" }}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`} style={{ flexBasis: "100%" }}>Kaydedildi.</p>}
    </form>
  );
}
