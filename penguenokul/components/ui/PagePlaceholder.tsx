// Henüz geliştirilmemiş sayfalar için geçici içerik. Faz ilerledikçe gerçek sayfalarla değiştirilecek.
export default function PagePlaceholder({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <section>
      <h1 style={{ fontSize: "var(--text-2xl)" }}>{title}</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Bu sayfa {phase} kapsamında geliştirilecek.
      </p>
    </section>
  );
}
