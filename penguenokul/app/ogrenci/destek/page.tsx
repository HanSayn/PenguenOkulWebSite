import type { Metadata } from "next";
import { requireStudent } from "@/lib/session";
import { NewTicketForm } from "@/components/support/forms";
import { TicketList } from "@/components/support/TicketPages";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Destek" };
export const dynamic = "force-dynamic";

export default async function OgrenciDestekPage() {
  const { user } = await requireStudent();
  return (
    <>
      <h1 className={styles.pageTitle}>Destek</h1>
      <p className={styles.sub}>Bir sorun mu var? Talep aç, ekibimiz buradan yanıtlasın.</p>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Yeni talep</h2>
        <NewTicketForm />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Taleplerin</h2>
        <TicketList userId={user.id} areaBase="/ogrenci/destek" />
      </section>
    </>
  );
}
