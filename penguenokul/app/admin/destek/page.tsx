import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import SupportStatus from "@/components/support/SupportStatus";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Destek" };
export const dynamic = "force-dynamic";

const filters = [
  { value: "", label: "Tümü" },
  { value: "OPEN", label: "Açık" },
  { value: "IN_PROGRESS", label: "İnceleniyor" },
  { value: "CLOSED", label: "Kapalı" },
];

export default async function AdminDestekPage({ searchParams }: { searchParams: { durum?: string } }) {
  await requireAdmin();
  const durum = ["OPEN", "IN_PROGRESS", "CLOSED"].includes(searchParams.durum ?? "") ? searchParams.durum! : "";

  const tickets = await prisma.supportTicket.findMany({
    where: durum ? { status: durum as "OPEN" | "IN_PROGRESS" | "CLOSED" } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: { id: true, subject: true, status: true, createdAt: true, user: { select: { email: true, role: true } } },
  });

  return (
    <>
      <h1 className={styles.pageTitle}>Destek</h1>
      <p className={styles.sub}>Öğrenci ve öğretmen talepleri. Yanıt yazdığında talep otomatik olarak “İnceleniyor” durumuna geçer.</p>

      <nav style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/destek?durum=${f.value}` : "/admin/destek"}
            className={durum === f.value ? styles.button : styles.linkButton}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {tickets.length === 0 ? (
        <div className={styles.empty}>Bu filtrede talep yok.</div>
      ) : (
        <ul className={styles.list}>
          {tickets.map((t) => (
            <li key={t.id} className={styles.row}>
              <div className={styles.rowMain}>
                <Link href={`/admin/destek/${t.id}`} className={styles.rowTitle}>{t.subject}</Link>
                <span className={styles.rowMeta}>
                  {t.user.email} · {t.user.role === "TEACHER" ? "öğretmen" : "öğrenci"} · {formatDateTime(t.createdAt)}
                </span>
              </div>
              <SupportStatus status={t.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
