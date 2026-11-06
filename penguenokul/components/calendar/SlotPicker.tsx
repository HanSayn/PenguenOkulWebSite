"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestLessonAction } from "@/lib/student-actions";
import styles from "@/components/ui/panel.module.css";

export type SlotDay = { ymd: string; label: string; slots: { iso: string; time: string }[] };

type Props = {
  teacherId: string;
  days: SlotDay[];
  topics: { id: string; name: string }[];
  canTrial: boolean;
  canPackage: boolean;
};

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={disabled || pending}>
      {pending ? "Gönderiliyor…" : "Ders talebi gönder"}
    </button>
  );
}

export default function SlotPicker({ teacherId, days, topics, canTrial, canPackage }: Props) {
  const [state, action] = useFormState(requestLessonAction, undefined);
  const [selected, setSelected] = useState("");
  // Hem deneme hem paket hakkı varsa öğrenci seçer; varsayılan deneme
  const [type, setType] = useState<"trial" | "package">(canTrial ? "trial" : "package");

  if (!canTrial && !canPackage) {
    return (
      <div className={styles.empty}>
        Ders talebi göndermek için deneme dersi ya da paket hakkın olması gerekiyor.{" "}
        <Link href="/ogrenci/paketler">Paketlere göz at</Link>
      </div>
    );
  }

  if (days.length === 0) {
    return <div className={styles.empty}>Bu öğretmenin önümüzdeki günlerde müsait saati yok.</div>;
  }

  return (
    <form action={action} className={styles.booking}>
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="startsAt" value={selected} />
      <input type="hidden" name="type" value={type} />

      {state?.error && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>
      )}

      {canTrial && canPackage && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className={styles.label}>Hangi hakkını kullanacaksın?</legend>
          <div className={styles.slots}>
            <label className={styles.slot}>
              <input type="radio" name="typeChoice" checked={type === "trial"} onChange={() => setType("trial")} />
              Ücretsiz deneme dersi
            </label>
            <label className={styles.slot}>
              <input type="radio" name="typeChoice" checked={type === "package"} onChange={() => setType("package")} />
              Paket hakkım
            </label>
          </div>
        </fieldset>
      )}
      {canTrial && !canPackage && <p className={styles.rowMeta}>Bu ders ücretsiz deneme dersin olarak planlanacak.</p>}

      {topics.length > 0 && (
        <div>
          <label htmlFor="topicId" className={styles.label}>Konu (isteğe bağlı)</label>
          <select id="topicId" name="topicId" className={styles.select} defaultValue="">
            <option value="">Belirtmek istemiyorum</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <span className={styles.label}>Müsait saatler</span>
        <div className={styles.booking}>
          {days.map((day) => (
            <div key={day.ymd} className={styles.day}>
              <span className={styles.dayLabel}>{day.label}</span>
              <div className={styles.slots}>
                {day.slots.map((s) => (
                  <label key={s.iso} className={styles.slot}>
                    <input
                      type="radio"
                      name="slot"
                      value={s.iso}
                      checked={selected === s.iso}
                      onChange={() => setSelected(s.iso)}
                    />
                    {s.time}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Submit disabled={!selected} />
      </div>
      <p className={styles.rowMeta}>Öğretmen talebini 24 saat içinde yanıtlamazsa talep otomatik iptal olur.</p>
    </form>
  );
}
