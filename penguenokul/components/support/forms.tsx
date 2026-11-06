"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createTicketAction, replyTicketAction, setTicketStatusAction, type SupportState } from "@/lib/support-actions";
import styles from "@/components/ui/panel.module.css";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function NewTicketForm() {
  const [state, action] = useFormState<SupportState, FormData>(createTicketAction, undefined);
  return (
    <form action={action} className={styles.actionsStack}>
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      <div className={styles.field}>
        <label htmlFor="subject" className={styles.label}>Konu</label>
        <input id="subject" name="subject" required maxLength={120} className={styles.input} />
      </div>
      <div className={styles.field}>
        <label htmlFor="message" className={styles.label}>Mesajın</label>
        <textarea id="message" name="message" required rows={4} maxLength={2000} className={styles.input} style={{ width: "100%", maxWidth: 560 }} />
      </div>
      <div><Submit label="Talep oluştur" pendingLabel="Gönderiliyor…" /></div>
    </form>
  );
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useFormState<SupportState, FormData>(replyTicketAction, undefined);
  return (
    <form action={action} className={styles.actionsStack}>
      <input type="hidden" name="ticketId" value={ticketId} />
      {state?.error && <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>{state.error}</p>}
      <textarea name="content" required rows={3} maxLength={2000} aria-label="Yanıt" className={styles.input} style={{ width: "100%", maxWidth: 560 }} />
      <div><Submit label="Yanıtla" pendingLabel="Gönderiliyor…" /></div>
    </form>
  );
}

const statusLabels: Record<string, string> = { OPEN: "Açık", IN_PROGRESS: "İnceleniyor", CLOSED: "Kapalı" };

export function StatusForm({ ticketId, status }: { ticketId: string; status: string }) {
  return (
    <form action={setTicketStatusAction} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <select name="status" defaultValue={status} className={styles.input} aria-label="Talep durumu">
        {Object.entries(statusLabels).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <button type="submit" className={styles.linkButton}>Durumu kaydet</button>
    </form>
  );
}
