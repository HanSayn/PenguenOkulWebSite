"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadTeacherPhotoAction, removeTeacherPhotoAction } from "@/lib/teacher-photo-actions";
import styles from "@/components/ui/panel.module.css";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? "Yükleniyor…" : "Fotoğrafı yükle"}
    </button>
  );
}

export default function PhotoForm({ photo, name }: { photo: string | null; name: string }) {
  const [state, action] = useFormState(uploadTeacherPhotoAction, undefined);
  return (
    <div className={styles.actionsStack}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${name} profil fotoğrafı`} width={96} height={96} style={{ borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <span aria-hidden style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--surface-muted)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--text-muted)" }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <form action={action} className={styles.actionsStack}>
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className={styles.input} />
            <span className={styles.rowMeta}>JPG, PNG veya WebP, en fazla 2 MB.</span>
            <div><Submit /></div>
          </form>
          {photo && (
            <form action={removeTeacherPhotoAction}>
              <button type="submit" className={styles.linkButton}>Fotoğrafı kaldır</button>
            </form>
          )}
        </div>
      </div>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      {state?.ok && <p role="status" className={`${styles.alert} ${styles.alertOk}`}>Fotoğrafın güncellendi.</p>}
    </div>
  );
}
