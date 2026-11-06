import type { Metadata } from "next";
import { requireStudent } from "@/lib/session";
import ThreadPage from "@/components/messages/ThreadPage";

export const metadata: Metadata = { title: "Mesajlar" };
export const dynamic = "force-dynamic";

export default async function OgrenciKonusmaPage({ params }: { params: { teacherId: string } }) {
  const { user, student } = await requireStudent();
  return (
    <ThreadPage
      viewer={{ userId: user.id, role: "STUDENT", profileId: student.id, name: student.name }}
      otherProfileId={params.teacherId}
      backHref="/ogrenci/mesajlar"
    />
  );
}
