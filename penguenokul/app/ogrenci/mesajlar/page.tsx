import type { Metadata } from "next";
import { requireStudent } from "@/lib/session";
import Inbox from "@/components/messages/Inbox";

export const metadata: Metadata = { title: "Mesajlar" };
export const dynamic = "force-dynamic";

export default async function OgrenciMesajlarPage() {
  const { user, student } = await requireStudent();
  return (
    <Inbox
      viewer={{ userId: user.id, role: "STUDENT", profileId: student.id, name: student.name }}
      basePath="/ogrenci/mesajlar"
    />
  );
}
