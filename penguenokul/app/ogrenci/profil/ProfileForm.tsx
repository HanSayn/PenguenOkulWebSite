"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveStudentProfileAction } from "@/lib/student-profile-actions";
import { GRADES, TARGET_EXAMS } from "@/lib/student-options";
import styles from "@/components/ui/panel.module.css";

type Props = {
  name: string;
  phone: string;
  grade: string;
  targetExam: string;
  parentName: string;
  parentPhone: string;
  smsConsent: boolean;
};

const gradeLabel = (g: string) => (g === "mezun" ? "Mezun" : `${g}. sınıf`);

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

export default function ProfileForm(props: Props) {
  const [state, action] = useFormState(saveStudentProfileAction, undefined);

  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Profilin kaydedildi.</p>}

      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>Ad soyad</label>
        <input id="name" name="name" defaultValue={props.name} required maxLength={80} className={`${styles.input} ${styles.textInput}`} />
      </div>

      <div className={styles.field}>
        <label htmlFor="phone" className={styles.label}>Telefon (isteğe bağlı)</label>
        <input id="phone" name="phone" defaultValue={props.phone} inputMode="tel" autoComplete="tel" className={styles.input} />
        <span className={styles.rowMeta}>Öğretmenlerin telefonunu görmez; iletişim platform üzerinden kalır.</span>
      </div>

      <div className={styles.field}>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <input type="checkbox" name="smsConsent" defaultChecked={props.smsConsent} />
          <span>Dersimden 1 saat önce SMS ile hatırlatma gönderilsin</span>
        </label>
        <span className={styles.rowMeta}>İstediğin zaman kapatabilirsin. Telefon numarası gerekir.</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="grade" className={styles.label}>Sınıf</label>
        <select id="grade" name="grade" defaultValue={props.grade} className={styles.input}>
          <option value="">Seçmedim</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>{gradeLabel(g)}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="targetExam" className={styles.label}>Hedef sınav</label>
        <select id="targetExam" name="targetExam" defaultValue={props.targetExam} className={styles.input}>
          <option value="">Seçmedim</option>
          {TARGET_EXAMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "var(--space-3)" }}>
        <legend className={styles.label}>Veli bilgileri (isteğe bağlı)</legend>
        <div className={styles.field}>
          <label htmlFor="parentName" className={styles.label}>Veli adı</label>
          <input id="parentName" name="parentName" defaultValue={props.parentName} maxLength={80} className={styles.input} />
        </div>
        <div className={styles.field}>
          <label htmlFor="parentPhone" className={styles.label}>Veli telefonu</label>
          <input id="parentPhone" name="parentPhone" defaultValue={props.parentPhone} inputMode="tel" className={styles.input} />
          <span className={styles.rowMeta}>Yalnızca yönetim bu bilgiyi görür.</span>
        </div>
      </fieldset>

      <div>
        <Submit />
      </div>
    </form>
  );
}
