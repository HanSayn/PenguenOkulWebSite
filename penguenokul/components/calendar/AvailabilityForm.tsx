"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addAvailabilityAction } from "@/lib/teacher-actions";
import styles from "@/components/ui/panel.module.css";

const days = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 0, label: "Pazar" },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Ekleniyor…" : "Ekle"}
    </button>
  );
}

export default function AvailabilityForm({ minDate }: { minDate: string }) {
  const [state, action] = useFormState(addAvailabilityAction, undefined);
  const [kind, setKind] = useState<"recurring" | "specific">("recurring");
  const formRef = useRef<HTMLFormElement>(null);

  // Başarılı eklemeden sonra formu temizle
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Müsaitlik eklendi.</p>}

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor="kind" className={styles.label}>Tür</label>
          <select
            id="kind"
            name="kind"
            className={styles.input}
            value={kind}
            onChange={(e) => setKind(e.target.value as "recurring" | "specific")}
          >
            <option value="recurring">Her hafta tekrarlayan</option>
            <option value="specific">Tek seferlik tarih</option>
          </select>
        </div>

        {kind === "recurring" ? (
          <div className={styles.field}>
            <label htmlFor="dayOfWeek" className={styles.label}>Gün</label>
            <select id="dayOfWeek" name="dayOfWeek" className={styles.input} defaultValue="1">
              {days.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className={styles.field}>
            <label htmlFor="date" className={styles.label}>Tarih</label>
            <input id="date" name="date" type="date" min={minDate} required className={styles.input} />
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="startTime" className={styles.label}>Başlangıç</label>
          <input id="startTime" name="startTime" type="time" step={900} required defaultValue="18:00" className={styles.input} />
        </div>
        <div className={styles.field}>
          <label htmlFor="endTime" className={styles.label}>Bitiş</label>
          <input id="endTime" name="endTime" type="time" step={900} required defaultValue="21:00" className={styles.input} />
        </div>

        <Submit />
      </div>
      <p className={styles.rowMeta}>Aralık, öğrencilere 1 saatlik dilimler halinde gösterilir.</p>
    </form>
  );
}
