import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
      <p style={{ fontSize: 48 }} aria-hidden="true">🐧</p>
      <h1>Aradığın sayfa bulunamadı</h1>
      <p style={{ color: "var(--text-muted)", margin: "12px 0 24px" }}>
        Bağlantı değişmiş ya da sayfa kaldırılmış olabilir.
      </p>
      <Link href="/">Ana sayfaya dön</Link>
    </main>
  );
}
