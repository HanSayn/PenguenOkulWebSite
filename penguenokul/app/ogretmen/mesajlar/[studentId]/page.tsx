import type { Metadata } from "next";
import { requireTeacher } from "@/lib/session";
import { hasLessonBetween, TEACHING_STATUSES } from "@/lib/relations";
import ThreadPage from "@/components/messages/ThreadPage";

export const metadata: Metadata = { title: "Mesajlar" };
export const dynamic = "force-dynamic";

export default async function OgretmenKonusmaPage({ params }: { params: { studentId: string } }) {
  const { user, teacher } = await requireTeacher();

  // Takip sayfası yalnızca gerçek ders ilişkisi olan öğrenciler için var
  const tracked = await hasLessonBetween(teacher.id, params.studentId, TEACHING_STATUSES);

  return (
    <ThreadPage
      viewer={{ userId: user.id, role: "TEACHER", profileId: teacher.id, name: teacher.name }}
      otherProfileId={params.studentId}
      backHref="/ogretmen/mesajlar"
      profileHref={tracked ? `/ogretmen/ogrencilerim/${params.studentId}` : undefined}
    />
  );
}
