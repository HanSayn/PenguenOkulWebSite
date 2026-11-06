import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { TicketDetail } from "@/components/support/TicketPages";

export const metadata: Metadata = { title: "Destek talebi" };
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: { ticketId: string } }) {
  const { user } = await requireAdmin();
  return <TicketDetail ticketId={params.ticketId} viewerId={user.id} backHref="/admin/destek" isAdmin />;
}
