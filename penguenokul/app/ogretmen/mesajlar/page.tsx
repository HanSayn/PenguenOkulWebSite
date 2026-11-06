import type { Metadata } from "next";
import { requireTeacher } from "@/lib/session";
import Inbox from "@/components/messages/Inbox";

export const metadata: Metadata = { title: "Mesajlar" };
export const dynamic = "force-dynamic";

export default async function OgretmenMesajlarPage() {
  const { user, teacher } = await requireTeacher();
  return (
    <Inbox
      viewer={{ userId: user.id, role: "TEACHER", profileId: teacher.id, name: teacher.name }}
      basePath="/ogretmen/mesajlar"
    />
  );
}
