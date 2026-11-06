"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitReviewAction, type ReviewState } from "@/lib/review-actions";
import panel from "@/components/ui/panel.module.css";
import styles from "./reviews.module.css";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={panel.button} disabled={pending}>
      {pending ? "Gönderiliyor…" : "Gönder"}
    </button>
  );
}

export default function ReviewForm({ lessonId }: { lessonId: string }) {
  const [state, action] = useFormState<ReviewState, FormData>(submitReviewAction, undefined);
  if (state?.ok) return <p role="status" className={styles.thanks}>Teşekkürler, değerlendirmen kaydedildi.</p>;
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <fieldset className={styles.stars}>
        <legend className={styles.legend}>Dersi nasıl buldun?</legend>
        {[5, 4, 3, 2, 1].map((n) => (
          <label key={n} className={styles.star} title={`${n} yıldız`}>
            <input type="radio" name="rating" value={n} required />
            <span aria-hidden>★</span>
            <span className={styles.sr}>{n} yıldız</span>
          </label>
        ))}
      </fieldset>
      <textarea name="comment" rows={2} maxLength={500} placeholder="İstersen kısaca yaz (isteğe bağlı)" className={styles.text} />
      {state?.error && <p role="alert" className={styles.err}>{state.error}</p>}
      <Submit />
    </form>
  );
}
