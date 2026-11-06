import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import Thread from "./Thread";
import { ReplyForm, StatusForm } from "./forms";
import SupportStatus from "./SupportStatus";
import styles from "@/components/ui/panel.module.css";

// Ortak talep ekranları: öğrenci, öğretmen ve yönetici aynı görünümü kullanır.
// Kişinin kendi olmayan talebi bulunamadı sayılır (kimlik ifşası yok).
export async function TicketDetail({
  ticketId,
  viewerId,
  backHref,
  isAdmin,
}: {
  ticketId: string;
  viewerId: string;
  backHref: string;
  isAdmin: boolean;
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { email: true, role: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { role: true, email: true } } } },
    },
  });
  if (!ticket || (!isAdmin && ticket.userId !== viewerId)) {
    return <div className={styles.empty}>Talep bulunamadı. <Link href={backHref}>Listeye dön</Link></div>;
  }

  return (
    <>
      <Link href={backHref} className={styles.rowMeta}>← Taleplere dön</Link>
      <section className={styles.panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <h1 className={styles.pageTitle} style={{ margin: 0 }}>{ticket.subject}</h1>
          <SupportStatus status={ticket.status} />
        </div>
        <p className={styles.rowMeta}>
          Açılış: {formatDateTime(ticket.createdAt)}
          {isAdmin && <> · Talep eden: {ticket.user.email} ({ticket.user.role === "TEACHER" ? "öğretmen" : "öğrenci"})</>}
        </p>
        {isAdmin && <StatusForm ticketId={ticket.id} status={ticket.status} />}
      </section>

      <section className={styles.panel}>
        <Thread messages={ticket.messages} viewerId={viewerId} />
      </section>

      <section className={styles.panel}>
        {ticket.status === "CLOSED" ? (
          <p className={styles.rowMeta}>Bu talep kapatıldı.</p>
        ) : (
          <ReplyForm ticketId={ticket.id} />
        )}
      </section>
    </>
  );
}

export async function TicketList({ userId, areaBase }: { userId: string; areaBase: string }) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, subject: true, status: true, createdAt: true },
  });
  if (tickets.length === 0) return <div className={styles.empty}>Henüz talebin yok.</div>;
  return (
    <ul className={styles.list}>
      {tickets.map((t) => (
        <li key={t.id} className={styles.row}>
          <div className={styles.rowMain}>
            <Link href={`${areaBase}/${t.id}`} className={styles.rowTitle}>{t.subject}</Link>
            <span className={styles.rowMeta}>{formatDateTime(t.createdAt)}</span>
          </div>
          <SupportStatus status={t.status} />
        </li>
      ))}
    </ul>
  );
}
