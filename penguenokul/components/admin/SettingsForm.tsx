"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateSettingsAction } from "@/lib/admin-actions";
import styles from "@/components/ui/panel.module.css";

type Field = {
  key: string;
  label: string;
  unit: string;
  hint: string;
  min: number;
  max: number;
  value: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

export default function SettingsForm({ fields }: { fields: Field[] }) {
  const [state, action] = useFormState(updateSettingsAction, undefined);

  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Ayarlar kaydedildi.</p>}

      {fields.map((f) => (
        <div key={f.key} className={styles.field}>
          <label htmlFor={f.key} className={styles.label}>
            {f.label} ({f.unit})
          </label>
          <input
            id={f.key}
            name={f.key}
            type="number"
            inputMode="numeric"
            min={f.min}
            max={f.max}
            step={1}
            defaultValue={f.value}
            required
            className={styles.input}
            aria-describedby={`${f.key}-hint`}
          />
          <span id={`${f.key}-hint`} className={styles.rowMeta}>{f.hint}</span>
        </div>
      ))}

      <div>
        <Submit />
      </div>
    </form>
  );
}
