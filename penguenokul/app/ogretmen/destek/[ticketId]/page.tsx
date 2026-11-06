import type { Metadata } from "next";
import { requireTeacher } from "@/lib/session";
import { TicketDetail } from "@/components/support/TicketPages";

export const metadata: Metadata = { title: "Destek talebi" };
export const dynamic = "force-dynamic";

export default async function OgretmenTicketPage({ params }: { params: { ticketId: string } }) {
  const { user } = await requireTeacher();
  return <TicketDetail ticketId={params.ticketId} viewerId={user.id} backHref="/ogretmen/destek" isAdmin={false} />;
}
