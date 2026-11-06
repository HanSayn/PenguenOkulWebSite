import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import ProfileForm from "./ProfileForm";
import PhotoForm from "@/components/teachers/PhotoForm";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

export default async function OgretmenProfilPage() {
  const { teacher } = await requireTeacher();

  const [subjects, mine] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" } }) as Promise<{ id: string; name: string }[]>,
    prisma.teacherSubject.findMany({
      where: { teacherId: teacher.id },
      select: { subjectId: true },
    }) as Promise<{ subjectId: string }[]>,
  ]);
  const selected = new Set(mine.map((m) => m.subjectId));

  return (
    <>
      <h1 className={styles.pageTitle}>Profil</h1>
      <p className={styles.sub}>Öğrenciler seni bu bilgilerle tanır. Başvurun onaylanmadan önce de düzenleyebilirsin.</p>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Fotoğraf</h2>
        <PhotoForm photo={teacher.photo ?? null} name={teacher.name} />
      </section>

      <section className={styles.panel}>
        <ProfileForm
          name={teacher.name}
          bio={teacher.bio ?? ""}
          osymScore={teacher.osymScore != null ? String(teacher.osymScore) : ""}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, selected: selected.has(s.id) }))}
        />
      </section>
    </>
  );
}
