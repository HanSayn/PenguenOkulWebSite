import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Sık sorulan sorular" };
export const dynamic = "force-dynamic";

export default async function SssPage() {
  const faqs = await prisma.faqItem.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true },
  });
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-6) 16px" }}>
      <p><Link href="/" className={styles.rowMeta}>← Ana sayfa</Link></p>
      <h1 className={styles.pageTitle}>Sık sorulan sorular</h1>
      {faqs.length === 0 ? (
        <div className={styles.empty}>Şimdilik soru yok.</div>
      ) : (
        <div className={styles.actionsStack}>
          {faqs.map((f) => (
            <details key={f.id} className={styles.panel}>
              <summary style={{ fontWeight: 600, cursor: "pointer" }}>{f.question}</summary>
              <p style={{ whiteSpace: "pre-wrap", marginTop: "var(--space-3)" }}>{f.answer}</p>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
