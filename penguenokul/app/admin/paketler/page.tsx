import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { togglePackageAction } from "@/lib/package-actions";
import { formatTL } from "@/lib/format";
import PackageForm from "./PackageForm";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Paketler" };
export const dynamic = "force-dynamic";

const toTL = (kurus: number) => (kurus % 100 === 0 ? String(kurus / 100) : (kurus / 100).toFixed(2).replace(".", ","));

export default async function AdminPaketlerPage() {
  await requireAdmin();
  const packages = await prisma.package.findMany({
    orderBy: [{ isActive: "desc" }, { price: "asc" }],
    include: { _count: { select: { purchases: true } } },
  });

  return (
    <>
      <h1 className={styles.pageTitle}>Paketler</h1>
      <p className={styles.sub}>
        Fiyat değişikliği yalnızca bundan sonraki satın almaları etkiler. Satın alınmış paketlerin ders başı değeri alım anında sabitlenir. Paketler silinmez, satıştan kaldırılır.
      </p>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Yeni paket</h2>
        <PackageForm submitLabel="Paketi ekle" />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mevcut paketler</h2>
        <ul className={styles.list}>
          {packages.map((p) => (
            <li key={p.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {p.name} <span className={styles.tag}>{p.isActive ? "Satışta" : "Satışta değil"}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    {formatTL(p.price)} · {p.lessonCount} ders · {p.durationMonths} ay · {p._count.purchases} satın alma
                  </span>
                </div>
                <form action={togglePackageAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className={styles.buttonSecondary}>{p.isActive ? "Satıştan kaldır" : "Satışa al"}</button>
                </form>
              </div>
              <PackageForm id={p.id} name={p.name} lessonCount={p.lessonCount} durationMonths={p.durationMonths} priceTL={toTL(p.price)} submitLabel="Güncelle" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
