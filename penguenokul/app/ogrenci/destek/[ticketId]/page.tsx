import type { Metadata } from "next";
import { requireStudent } from "@/lib/session";
import { TicketDetail } from "@/components/support/TicketPages";

export const metadata: Metadata = { title: "Destek talebi" };
export const dynamic = "force-dynamic";

export default async function OgrenciTicketPage({ params }: { params: { ticketId: string } }) {
  const { user } = await requireStudent();
  return <TicketDetail ticketId={params.ticketId} viewerId={user.id} backHref="/ogrenci/destek" isAdmin={false} />;
}
