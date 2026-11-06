"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveProfileAction } from "@/lib/teacher-actions";
import styles from "@/components/ui/panel.module.css";

type Props = {
  name: string;
  bio: string;
  osymScore: string;
  subjects: { id: string; name: string; selected: boolean }[];
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

export default function ProfileForm({ name, bio, osymScore, subjects }: Props) {
  const [state, action] = useFormState(saveProfileAction, undefined);

  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Profilin kaydedildi.</p>}

      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>Ad soyad</label>
        <input id="name" name="name" defaultValue={name} required maxLength={80} className={`${styles.input} ${styles.textInput}`} />
      </div>

      <div className={styles.field}>
        <label htmlFor="bio" className={styles.label}>Kısa tanıtım</label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio}
          rows={4}
          maxLength={600}
          className={styles.input}
          style={{ width: "100%", maxWidth: 560, resize: "vertical" }}
        />
        <span className={styles.rowMeta}>Öğrenciler seni seçerken bu yazıyı görür (en fazla 600 karakter).</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="osymScore" className={styles.label}>ÖSYM puanı (isteğe bağlı)</label>
        <input id="osymScore" name="osymScore" defaultValue={osymScore} inputMode="decimal" className={styles.input} />
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={styles.label}>Anlattığın branşlar</legend>
        <div className={styles.slots}>
          {subjects.map((s) => (
            <label key={s.id} className={styles.slot}>
              <input type="checkbox" name="subjectIds" value={s.id} defaultChecked={s.selected} />
              {s.name}
            </label>
          ))}
        </div>
        <span className={styles.rowMeta}>Onaylanmak için en az bir branş seçmelisin.</span>
      </fieldset>

      <div>
        <Submit />
      </div>
    </form>
  );
}
