"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendMessageAction } from "@/lib/message-actions";
import panel from "@/components/ui/panel.module.css";
import styles from "./messages.module.css";

const MAX = 1000;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={panel.button} disabled={pending}>
      {pending ? "Gönderiliyor…" : "Gönder"}
    </button>
  );
}

export default function MessageComposer({ toProfileId }: { toProfileId: string }) {
  const [state, action] = useFormState(sendMessageAction, undefined);
  const [length, setLength] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Başarılı gönderimden sonra kutuyu temizle
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setLength(0);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className={styles.composer}>
      <input type="hidden" name="to" value={toProfileId} />
      {state?.error && <p role="alert" className={`${panel.alert} ${panel.alertErr}`}>{state.error}</p>}
      <label htmlFor="content" className="visually-hidden">Mesajın</label>
      <textarea
        id="content"
        name="content"
        rows={3}
        maxLength={MAX}
        required
        placeholder="Mesajını yaz…"
        onChange={(e) => setLength(e.target.value.length)}
      />
      <div className={styles.composerRow}>
        <span className={styles.counter}>{length}/{MAX}</span>
        <Submit />
      </div>
    </form>
  );
}
