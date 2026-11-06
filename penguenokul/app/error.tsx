"use client";

import Link from "next/link";

// Beklenmeyen hatada kullanıcıya teknik ayrıntı gösterilmez; ayrıntı sunucu günlüğündedir.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
      <h1>Bir şeyler ters gitti</h1>
      <p style={{ color: "var(--text-muted)", margin: "12px 0 24px" }}>
        İşlemin tamamlanmamış olabilir. Tekrar deneyebilir ya da ana sayfaya dönebilirsin.
        {error.digest && <><br />Destek için hata kodu: <code>{error.digest}</code></>}
      </p>
      <button type="button" onClick={reset} style={{ marginRight: 16 }}>Tekrar dene</button>
      <Link href="/">Ana sayfa</Link>
    </main>
  );
}
