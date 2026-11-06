import type { Metadata } from "next";
import { requireStudent } from "@/lib/session";
import NotificationList from "@/components/notifications/NotificationList";

export const metadata: Metadata = { title: "Bildirimler" };
export const dynamic = "force-dynamic";

export default async function OgrenciBildirimlerPage() {
  const { user } = await requireStudent();
  return <NotificationList userId={user.id} />;
}
